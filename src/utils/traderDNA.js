/**
 * traderDNA.js
 * Computes and manages the Trader Behavioral DNA Memory system for Foxy AI.
 */

const DB_NAME = 'foxy_config_db';
const DB_VERSION = 1;
const STORE_NAME = 'foxy_config';
const DNA_KEY = 'trader_dna_v1';

let _db = null;

function openDB() {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      return reject(new Error('IndexedDB not available'));
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'key' });
      }
    };
    req.onsuccess = (e) => {
      _db = e.target.result;
      resolve(_db);
    };
    req.onerror = (e) => {
      reject(e.target.error);
    };
  });
}

function parseDate(s) {
  if (!s) return null;
  const ymd = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/.exec(String(s));
  if (ymd) return new Date(+ymd[1], +ymd[2]-1, +ymd[3]);
  const dmy = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/.exec(String(s));
  if (dmy) return new Date(+dmy[3], +dmy[2]-1, +dmy[1]);
  const d = new Date(s); return isNaN(d) ? null : d;
}

/**
 * Pure synchronous computation from raw trades array.
 * @param {Array} trades - Array of trade objects.
 * @returns {Object|null} The computed Trader DNA profile.
 */
export function computeTraderDNA(trades) {
  if (!trades || !Array.isArray(trades)) return null;
  
  const closedTrades = trades.filter(t => t.status === 'Closed' || t.status === 'Partial');
  if (closedTrades.length === 0) return null;

  const sorted = [...closedTrades].sort((a, b) => {
    const da = parseDate(a.date) || new Date(0);
    const db = parseDate(b.date) || new Date(0);
    return da - db;
  });

  // holding days
  let holdingDaysArr = [];
  sorted.forEach(t => {
    if (t.holdingDays !== undefined && t.holdingDays !== null) {
      holdingDaysArr.push(Number(t.holdingDays));
    }
  });
  
  holdingDaysArr.sort((a, b) => a - b);
  let medianHoldingDays = 0;
  if (holdingDaysArr.length > 0) {
    const mid = Math.floor(holdingDaysArr.length / 2);
    medianHoldingDays = holdingDaysArr.length % 2 !== 0 ? holdingDaysArr[mid] : (holdingDaysArr[mid - 1] + holdingDaysArr[mid]) / 2;
  }
  
  let tradingStyle = 'Mixed';
  if (medianHoldingDays < 1) tradingStyle = 'Intraday';
  else if (medianHoldingDays < 5) tradingStyle = 'Swing';
  else if (medianHoldingDays < 30) tradingStyle = 'Positional';

  // primary setup
  const setups = {};
  sorted.forEach(t => {
    if (t.setup) {
      setups[t.setup] = (setups[t.setup] || 0) + 1;
    }
  });
  let primarySetup = 'Unknown';
  let maxSetupCount = 0;
  Object.keys(setups).forEach(s => {
    if (setups[s] > maxSetupCount) {
      maxSetupCount = setups[s];
      primarySetup = s;
    }
  });

  // Win Rate, avgWinR, avgLossR, profitFactor, expectancyR
  let wins = 0;
  let losses = 0;
  let totalWinR = 0;
  let totalLossR = 0;

  sorted.forEach(t => {
    const rr = parseFloat(t.rewardRisk) || 0;
    if (rr > 0) { wins++; totalWinR += rr; }
    else if (rr < 0) { losses++; totalLossR += Math.abs(rr); }
  });

  const total = wins + losses;
  const winRate = total > 0 ? (wins / total) : 0;
  const lossRate = total > 0 ? (losses / total) : 0;
  const avgWinR = wins > 0 ? (totalWinR / wins) : 0;
  const avgLossR = losses > 0 ? (totalLossR / losses) : 0;
  const profitFactor = totalLossR > 0 ? (totalWinR / totalLossR) : (totalWinR > 0 ? 999 : 0);
  const expectancyR = (winRate * avgWinR) - (lossRate * avgLossR);

  // Best/Worst Setup
  const setupStats = {};
  sorted.forEach(t => {
    if (!t.setup) return;
    if (!setupStats[t.setup]) setupStats[t.setup] = { name: t.setup, wins: 0, total: 0 };
    setupStats[t.setup].total++;
    const rr = parseFloat(t.rewardRisk) || 0;
    if (rr > 0) setupStats[t.setup].wins++;
  });
  
  let bestSetup = { name: 'None', winRate: 0, trades: 0 };
  let worstSetup = { name: 'None', winRate: 0, trades: 0 };
  if (Object.keys(setupStats).length > 0) {
    const sortedSetups = Object.values(setupStats).map(s => ({
      name: s.name, winRate: s.wins / s.total, trades: s.total
    })).sort((a, b) => b.winRate - a.winRate);
    bestSetup = sortedSetups[0];
    worstSetup = sortedSetups[sortedSetups.length - 1];
  }

  // Best/Worst Day of Week
  const dayStats = {};
  sorted.forEach(t => {
    const d = parseDate(t.date);
    if (!d) return;
    const day = d.toLocaleDateString('en-US', { weekday: 'long' });
    if (!dayStats[day]) dayStats[day] = { day, wins: 0, total: 0 };
    dayStats[day].total++;
    const rr = parseFloat(t.rewardRisk) || 0;
    if (rr > 0) dayStats[day].wins++;
  });

  let bestDayOfWeek = { day: 'None', winRate: 0, trades: 0 };
  let worstDayOfWeek = { day: 'None', winRate: 0, trades: 0 };
  if (Object.keys(dayStats).length > 0) {
    const sortedDays = Object.values(dayStats).map(d => ({
      day: d.day, winRate: d.wins / d.total, trades: d.total
    })).sort((a, b) => b.winRate - a.winRate);
    bestDayOfWeek = sortedDays[0];
    worstDayOfWeek = sortedDays[sortedDays.length - 1];
  }

  // maxWinStreak, maxLossStreak
  let currentWinStreak = 0;
  let currentLossStreak = 0;
  let maxWinStreak = 0;
  let maxLossStreak = 0;
  
  sorted.forEach(t => {
    const rr = parseFloat(t.rewardRisk) || 0;
    if (rr > 0) {
      currentWinStreak++;
      currentLossStreak = 0;
      if (currentWinStreak > maxWinStreak) maxWinStreak = currentWinStreak;
    } else if (rr < 0) {
      currentLossStreak++;
      currentWinStreak = 0;
      if (currentLossStreak > maxLossStreak) maxLossStreak = currentLossStreak;
    } else {
      currentWinStreak = 0;
      currentLossStreak = 0;
    }
  });

  // revengeTradingScore
  let revengeCases = 0;
  let totalLossesForRevenge = 0;
  for (let i = 0; i < sorted.length - 1; i++) {
    const t1 = sorted[i];
    const rr = parseFloat(t1.rewardRisk) || 0;
    if (rr < 0) {
      totalLossesForRevenge++;
      const t2 = sorted[i+1];
      const d1 = parseDate(t1.date);
      const d2 = parseDate(t2.date);
      if (d1 && d2) {
        const diffTime = Math.abs(d2 - d1);
        const diffDays = diffTime / (1000 * 60 * 60 * 24);
        if (diffDays <= 2) {
          revengeCases++;
        }
      }
    }
  }
  const revengeTradingScore = totalLossesForRevenge > 0 ? Math.round((revengeCases / totalLossesForRevenge) * 100) : 0;

  // lossCuttingDiscipline
  let passingTrades = 0;
  let totalLosingWithSl = 0;
  sorted.forEach(t => {
    const sl = parseFloat(t.sl) || 0;
    const pnl = parseFloat(t.pnl) || 0;
    const entry = parseFloat(t.entry) || 0;
    const qty = parseFloat(t.qty) || 0;
    if (sl > 0 && pnl < 0) {
      totalLosingWithSl++;
      if (Math.abs(pnl) <= Math.abs(entry - sl) * qty * 1.3) {
        passingTrades++;
      }
    }
  });
  const lossCuttingDiscipline = totalLosingWithSl > 0 ? Math.round((passingTrades / totalLosingWithSl) * 100) : 0;

  // positionSizingConsistency
  const posValues = sorted.map(t => (parseFloat(t.qty)||0) * (parseFloat(t.entry)||0)).filter(v => v > 0);
  let positionSizingConsistency = 0;
  let overallAvgPos = 0;
  if (posValues.length > 0) {
    overallAvgPos = posValues.reduce((a, b) => a + b, 0) / posValues.length;
    let variance = posValues.reduce((a, b) => a + Math.pow(b - overallAvgPos, 2), 0) / posValues.length;
    let stdDev = Math.sqrt(variance);
    let cv = stdDev / overallAvgPos;
    positionSizingConsistency = Math.max(0, Math.round(100 - cv * 100));
  }

  // overSizingAfterWins / underSizingAfterLosses
  let overSizingAfterWins = false;
  let underSizingAfterLosses = false;
  if (posValues.length > 0) {
    let recentAfterWins = [];
    let recentAfterLosses = [];
    let ws = 0;
    let ls = 0;
    for (let i = 0; i < sorted.length; i++) {
      const rr = parseFloat(sorted[i].rewardRisk) || 0;
      const pVal = (parseFloat(sorted[i].qty)||0) * (parseFloat(sorted[i].entry)||0);
      
      if (ws >= 3 && pVal > 0) recentAfterWins.push(pVal);
      if (ls >= 2 && pVal > 0) recentAfterLosses.push(pVal);
      
      if (rr > 0) { ws++; ls = 0; }
      else if (rr < 0) { ls++; ws = 0; }
      else { ws = 0; ls = 0; }
    }
    
    recentAfterWins = recentAfterWins.slice(-5);
    if (recentAfterWins.length > 0) {
      const avgAfterWins = recentAfterWins.reduce((a, b) => a + b, 0) / recentAfterWins.length;
      if (avgAfterWins > overallAvgPos * 1.3) overSizingAfterWins = true;
    }
    
    recentAfterLosses = recentAfterLosses.slice(-3);
    if (recentAfterLosses.length > 0) {
      const avgAfterLosses = recentAfterLosses.reduce((a, b) => a + b, 0) / recentAfterLosses.length;
      if (avgAfterLosses < overallAvgPos * 0.7) underSizingAfterLosses = true;
    }
  }

  // avgTimeBetweenTrades
  let gaps = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const d1 = parseDate(sorted[i].date);
    const d2 = parseDate(sorted[i+1].date);
    if (d1 && d2) {
      const diffTime = Math.abs(d2 - d1);
      gaps.push(diffTime / (1000 * 60 * 60 * 24));
    }
  }
  let avgTimeBetweenTrades = 0;
  if (gaps.length > 0) {
    avgTimeBetweenTrades = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  }

  // tradingFrequency
  let tradingFrequency = 'Low';
  if (sorted.length > 1 && gaps.length > 0) {
    const d1 = parseDate(sorted[0].date);
    const dn = parseDate(sorted[sorted.length-1].date);
    if (d1 && dn) {
      const totalMonths = Math.max(1, (dn - d1) / (1000 * 60 * 60 * 24 * 30));
      const tradesPerMonth = sorted.length / totalMonths;
      if (tradesPerMonth > 15) tradingFrequency = 'High';
      else if (tradesPerMonth > 5) tradingFrequency = 'Medium';
    }
  }

  // riskProfile
  let carArr = [];
  sorted.forEach(t => {
    if (t.capitalAtRisk !== undefined && t.capitalAtRisk !== null) {
      carArr.push(parseFloat(t.capitalAtRisk));
    }
  });
  carArr.sort((a, b) => a - b);
  let medianCar = 0;
  if (carArr.length > 0) {
    const mid = Math.floor(carArr.length / 2);
    medianCar = carArr.length % 2 !== 0 ? carArr[mid] : (carArr[mid - 1] + carArr[mid]) / 2;
  }
  let riskProfile = 'Moderate';
  if (medianCar < 1) riskProfile = 'Conservative';
  else if (medianCar <= 2) riskProfile = 'Moderate';
  else if (medianCar <= 3) riskProfile = 'Aggressive';
  else riskProfile = 'Reckless';

  return {
    tradingStyle,
    primarySetup,
    riskProfile,
    winRate,
    profitFactor,
    expectancyR,
    avgWinR,
    avgLossR,
    bestSetup,
    worstSetup,
    bestDayOfWeek,
    worstDayOfWeek,
    maxWinStreak,
    maxLossStreak,
    revengeTradingScore,
    lossCuttingDiscipline,
    positionSizingConsistency,
    overSizingAfterWins,
    underSizingAfterLosses,
    avgTimeBetweenTrades,
    tradingFrequency,
    computedAt: Date.now(),
    totalTradesAnalyzed: trades.length
  };
}

/**
 * Save computed DNA to IndexedDB.
 * @param {Object} dna 
 */
export async function saveTraderDNA(dna) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.put({ key: DNA_KEY, value: dna });
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/**
 * Load saved DNA from IndexedDB.
 * @returns {Promise<Object|null>}
 */
export async function loadTraderDNA() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(DNA_KEY);
    req.onsuccess = () => resolve(req.result ? req.result.value : null);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Get cached DNA if valid, else compute and save.
 * @param {Array} trades 
 * @returns {Promise<Object|null>}
 */
export async function getOrComputeDNA(trades) {
  if (!trades || !Array.isArray(trades)) return null;
  const cached = await loadTraderDNA();
  if (cached && cached.computedAt) {
    const ageHours = (Date.now() - cached.computedAt) / (1000 * 60 * 60);
    if (ageHours <= 6 && cached.totalTradesAnalyzed === trades.length) {
      return cached;
    }
  }
  const dna = computeTraderDNA(trades);
  if (dna) {
    await saveTraderDNA(dna);
  }
  return dna;
}

/**
 * Format DNA for Foxy system prompt context.
 * @param {Object} dna 
 * @returns {string}
 */
export function formatDNAForContext(dna) {
  if (!dna) return 'TRADER DNA PROFILE: Not available.';
  
  const tradesPerMonth = dna.avgTimeBetweenTrades > 0 ? Math.round(30 / dna.avgTimeBetweenTrades) : 0;
  
  const biasStr1 = dna.revengeTradingScore > 50 ? ' (HIGH RISK)' : '';
  const biasStr2 = dna.lossCuttingDiscipline > 70 ? ' (GOOD)' : '';
  
  return `TRADER DNA PROFILE:
- Trading Style: ${dna.tradingStyle} | Primary Setup: ${dna.primarySetup} | Risk Profile: ${dna.riskProfile}
- Win Rate: ${(dna.winRate * 100).toFixed(0)}% | Profit Factor: ${dna.profitFactor.toFixed(2)} | Expectancy: ${dna.expectancyR > 0 ? '+' : ''}${dna.expectancyR.toFixed(2)}R
- Best Setup: ${dna.bestSetup.name} (${(dna.bestSetup.winRate * 100).toFixed(0)}% WR, ${dna.bestSetup.trades} trades) | Worst: ${dna.worstSetup.name} (${(dna.worstSetup.winRate * 100).toFixed(0)}% WR, ${dna.worstSetup.trades} trades)
- Best Day: ${dna.bestDayOfWeek.day} (${(dna.bestDayOfWeek.winRate * 100).toFixed(0)}% WR) | Worst Day: ${dna.worstDayOfWeek.day} (${(dna.worstDayOfWeek.winRate * 100).toFixed(0)}% WR)
- Behavioral Biases: Revenge Trading Score: ${dna.revengeTradingScore}/100${biasStr1} | Loss Cutting Discipline: ${dna.lossCuttingDiscipline}/100${biasStr2}
- Sizing Consistency: ${dna.positionSizingConsistency}/100 | Oversizes after wins: ${dna.overSizingAfterWins ? 'YES' : 'NO'} | Undersizes after losses: ${dna.underSizingAfterLosses ? 'YES' : 'NO'}
- Max Win Streak: ${dna.maxWinStreak} | Max Loss Streak: ${dna.maxLossStreak}
- Trading Frequency: ${dna.tradingFrequency} (${tradesPerMonth} trades/month avg)`;
}
