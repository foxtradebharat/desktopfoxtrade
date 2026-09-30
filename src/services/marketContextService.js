// d:/tradeontip/src/services/marketContextService.js

function parseDateStr(s) {
  if (!s) return null;
  const ymd = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/.exec(String(s));
  if (ymd) return new Date(+ymd[1], +ymd[2]-1, +ymd[3]);
  const dmy = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/.exec(String(s));
  if (dmy) return new Date(+dmy[3], +dmy[2]-1, +dmy[1]);
  const d = new Date(s); return isNaN(d.getTime()) ? null : d;
}

function formatDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

const CACHE_KEY = 'foxtrade_market_cache_v1';
const CACHE_DURATION_MS = 6 * 60 * 60 * 1000; // 6 hours

export async function fetchAndCacheMarketData(forceRefresh = false) {
  try {
    let cached = localStorage.getItem(CACHE_KEY);
    if (cached && !forceRefresh) {
      cached = JSON.parse(cached);
      if (Date.now() - cached.cachedAt < CACHE_DURATION_MS) {
        return cached;
      }
    }
  } catch (e) {
    console.error('Error reading market cache:', e);
  }

  const result = { cachedAt: Date.now(), nifty: {}, vix: {} };

  try {
    const fetchYahoo = async (ticker) => {
      const baseUrl = (typeof window !== 'undefined')
        ? `/yahoo-api/v8/finance/chart/${ticker}?interval=1d&range=1y`
        : `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1y`;
      const response = await fetch(baseUrl);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      const timestamps = data.chart.result[0].timestamp;
      const prices = data.chart.result[0].indicators.adjclose[0].adjclose;
      const dict = {};
      timestamps.forEach((ts, i) => {
        const d = new Date(ts * 1000);
        dict[formatDateKey(d)] = prices[i];
      });
      return dict;
    };

    const [niftyData, vixData] = await Promise.all([
      fetchYahoo('%5ENSEI'),
      fetchYahoo('%5EINDIAVIX')
    ]);

    result.nifty = niftyData;
    result.vix = vixData;
    
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(result));
    } catch (e) {
      console.error('Error saving market cache:', e);
    }
  } catch (e) {
    console.error('Error fetching market data from Yahoo Finance. CORS issues may block this from the browser.', e);
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) return JSON.parse(cached);
    } catch (err) {}
  }

  return result;
}

export function getMarketContextForDate(dateStr, marketCache) {
  const d = parseDateStr(dateStr);
  if (!d || !marketCache || (!marketCache.nifty && !marketCache.vix)) {
    return { niftyClose: null, vixClose: null, marketTrend: null };
  }

  let closestNifty = null;
  let closestVix = null;
  let targetDate = d;
  
  // Find closest market date within 3 days backwards
  let marketDateStr = null;
  for (let i = 0; i < 3; i++) {
    const checkDate = new Date(d.getTime() - i * 24 * 60 * 60 * 1000);
    const dateKey = formatDateKey(checkDate);
    if (marketCache.nifty && marketCache.nifty[dateKey] !== undefined) {
      closestNifty = marketCache.nifty[dateKey];
      closestVix = marketCache.vix ? marketCache.vix[dateKey] : null;
      marketDateStr = dateKey;
      break;
    }
  }

  let marketTrend = null;
  if (marketDateStr && marketCache.nifty) {
    // Calculate 5-day prior avg
    let priorSum = 0;
    let priorCount = 0;
    const foundDate = parseDateStr(marketDateStr);
    for (let i = 1; i <= 10; i++) { // Look back up to 10 days to find 5 trading days
      if (priorCount >= 5) break;
      const checkDate = new Date(foundDate.getTime() - i * 24 * 60 * 60 * 1000);
      const k = formatDateKey(checkDate);
      if (marketCache.nifty[k] !== undefined && marketCache.nifty[k] !== null) {
        priorSum += marketCache.nifty[k];
        priorCount++;
      }
    }
    
    if (priorCount > 0 && closestNifty !== null) {
      const priorAvg = priorSum / priorCount;
      const diffPct = ((closestNifty - priorAvg) / priorAvg) * 100;
      if (diffPct > 0.5) marketTrend = 'BULL';
      else if (diffPct < -0.5) marketTrend = 'BEAR';
      else marketTrend = 'NEUTRAL';
    }
  }

  return { niftyClose: closestNifty, vixClose: closestVix, marketTrend };
}

export function computeMarketCorrelation(trades, marketCache) {
  const result = {
    winRateOnBullDays: { wins: 0, total: 0 },
    winRateOnBearDays: { wins: 0, total: 0 },
    winRateOnNeutralDays: { wins: 0, total: 0 },
    vixBelow15: { pnlSum: 0, count: 0 },
    vixAbove18: { pnlSum: 0, count: 0 },
    vixRanges: {
      '<12': { wins: 0, total: 0, label: '< 12' },
      '12-15': { wins: 0, total: 0, label: '12-15' },
      '15-18': { wins: 0, total: 0, label: '15-18' },
      '18-22': { wins: 0, total: 0, label: '18-22' },
      '>22': { wins: 0, total: 0, label: '> 22' }
    },
    tradeCountWithData: 0
  };

  if (!trades || !marketCache) return result;

  const validTrades = trades.filter(t => t.status === 'Closed' || t.status === 'Partial');

  for (const trade of validTrades) {
    const context = getMarketContextForDate(trade.entryDate || trade.date, marketCache);
    if (context.niftyClose || context.vixClose) {
      result.tradeCountWithData++;
      const isWin = trade.pnl > 0 || trade.netPnl > 0 || trade.realizedPnl > 0;
      const pnl = trade.pnl || trade.netPnl || trade.realizedPnl || 0;

      if (context.marketTrend === 'BULL') {
        result.winRateOnBullDays.total++;
        if (isWin) result.winRateOnBullDays.wins++;
      } else if (context.marketTrend === 'BEAR') {
        result.winRateOnBearDays.total++;
        if (isWin) result.winRateOnBearDays.wins++;
      } else if (context.marketTrend === 'NEUTRAL') {
        result.winRateOnNeutralDays.total++;
        if (isWin) result.winRateOnNeutralDays.wins++;
      }

      if (context.vixClose) {
        if (context.vixClose < 15) {
          result.vixBelow15.pnlSum += pnl;
          result.vixBelow15.count++;
        }
        if (context.vixClose >= 18) {
          result.vixAbove18.pnlSum += pnl;
          result.vixAbove18.count++;
        }

        let range = null;
        if (context.vixClose < 12) range = '<12';
        else if (context.vixClose < 15) range = '12-15';
        else if (context.vixClose < 18) range = '15-18';
        else if (context.vixClose < 22) range = '18-22';
        else range = '>22';

        result.vixRanges[range].total++;
        if (isWin) result.vixRanges[range].wins++;
      }
    }
  }

  // Find best VIX range
  let bestVixRange = null;
  let bestVixWinRate = -1;
  for (const [key, data] of Object.entries(result.vixRanges)) {
    if (data.total >= 3) { // Require at least 3 trades for it to be significant
      const wr = data.wins / data.total;
      if (wr > bestVixWinRate) {
        bestVixWinRate = wr;
        bestVixRange = data.label;
      }
    }
  }
  
  if (!bestVixRange) {
     for (const [key, data] of Object.entries(result.vixRanges)) {
        if (data.total > 0) {
            const wr = data.wins / data.total;
            if (wr > bestVixWinRate) {
              bestVixWinRate = wr;
              bestVixRange = data.label;
            }
        }
     }
  }

  return {
    ...result,
    winRateOnBullDaysPercent: result.winRateOnBullDays.total ? Math.round((result.winRateOnBullDays.wins / result.winRateOnBullDays.total) * 100) : 0,
    winRateOnBearDaysPercent: result.winRateOnBearDays.total ? Math.round((result.winRateOnBearDays.wins / result.winRateOnBearDays.total) * 100) : 0,
    winRateOnNeutralDaysPercent: result.winRateOnNeutralDays.total ? Math.round((result.winRateOnNeutralDays.wins / result.winRateOnNeutralDays.total) * 100) : 0,
    avgPnlWhenVixBelow15: result.vixBelow15.count ? (result.vixBelow15.pnlSum / result.vixBelow15.count) : 0,
    avgPnlWhenVixAbove18: result.vixAbove18.count ? (result.vixAbove18.pnlSum / result.vixAbove18.count) : 0,
    bestVixRange
  };
}

export function formatMarketContextForFoxy(correlation) {
  if (!correlation || correlation.tradeCountWithData < 5) return "";

  const bull = correlation.winRateOnBullDaysPercent;
  const bear = correlation.winRateOnBearDaysPercent;
  const neutral = correlation.winRateOnNeutralDaysPercent;
  
  const vBelow = Math.round(correlation.avgPnlWhenVixBelow15);
  const vAbove = Math.round(correlation.avgPnlWhenVixAbove18);
  
  const vBelowStr = vBelow >= 0 ? `+₹${vBelow}` : `-₹${Math.abs(vBelow)}`;
  const vAboveStr = vAbove >= 0 ? `+₹${vAbove}` : `-₹${Math.abs(vAbove)}`;
  
  const vBelowIcon = vBelow >= 0 ? '▲' : '▼';
  const vAboveIcon = vAbove >= 0 ? '▲' : '▼';

  const bestVix = correlation.bestVixRange || "N/A";

  let advice = "Your edge is unclear; gather more data across market conditions.";
  if (bull > bear && bull > neutral) {
    advice = "Your strategy thrives in trending BULL markets. Consider sizing up during uptrends.";
  } else if (bear > bull && bear > neutral) {
    advice = "You perform best in BEAR markets. Short setups are highly effective for you.";
  } else if (vBelow > 0 && vBelow > vAbove) {
    advice = "Your edge increases significantly in low-volatility (VIX < 15) markets.";
  }

  return `MARKET CORRELATION ANALYSIS:
- Win rate on Bull market days: ${bull}% | Bear days: ${bear}% | Neutral days: ${neutral}%
- Best performance when VIX ${bestVix} (avg P/L ${vBelowIcon} ${vBelowStr} when <15) | Worst when VIX >18 (avg P/L ${vAboveIcon} ${vAboveStr})
- Advice: ${advice}`;
}
