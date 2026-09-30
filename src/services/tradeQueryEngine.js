// src/services/tradeQueryEngine.js
// Institutional deterministic trade query engine for FoxTrade Foxy AI

export function createTradeTable(trades) {
  return trades || [];
}

/**
 * Robust date parser supporting YYYY-MM-DD, DD-MM-YYYY, DD/MM/YYYY with optional time
 */
export function parseDateFoxy(s) {
  if (!s) return null;
  if (s instanceof Date) return isNaN(s.getTime()) ? null : s;

  const str = String(s).trim();
  let year = null, month = null, day = null;
  let hour = 0, minute = 0, second = 0;

  const timeMatch = /(\d{1,2}):(\d{2})(:(\d{2}))?/.exec(str);
  if (timeMatch) {
    hour = parseInt(timeMatch[1], 10);
    minute = parseInt(timeMatch[2], 10);
    second = timeMatch[4] ? parseInt(timeMatch[4], 10) : 0;
  }

  const ymd = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/.exec(str);
  if (ymd) {
    year = parseInt(ymd[1], 10);
    month = parseInt(ymd[2], 10) - 1;
    day = parseInt(ymd[3], 10);
  } else {
    const dmy = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/.exec(str);
    if (dmy) {
      day = parseInt(dmy[1], 10);
      month = parseInt(dmy[2], 10) - 1;
      year = parseInt(dmy[3], 10);
    }
  }

  if (year !== null && month !== null && day !== null) {
    return new Date(year, month, day, hour, minute, second);
  }

  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Format a Date object as YYYY-MM-DD for clean equality comparisons
 */
function toDateString(d) {
  if (!d) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Strips currency symbols (₹, $), commas, and whitespace, returning a clean number
 */
function sanitizeNumeric(val) {
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (val === null || val === undefined || val === '') return 0;
  const cleaned = String(val).replace(/[^0-9.-]/g, '');
  const num = Number(cleaned);
  return isNaN(num) ? 0 : num;
}

/**
 * Executes a deterministic analytical query over trade records
 */
export function runQuery(trades = [], querySpec = {}) {
  let filtered = Array.isArray(trades) ? [...trades] : [];

  if (querySpec.filters && Array.isArray(querySpec.filters)) {
    filtered = filtered.filter(t => {
      for (const filter of querySpec.filters) {
        let val;
        const tDate = parseDateFoxy(t.date);

        switch (filter.field) {
          case 'symbol': val = (t.name || t.symbol || ''); break;
          case 'setup': val = (t.setup || t.strategy || ''); break;
          case 'status': val = (t.status || ''); break;
          case 'segment': val = (t.segment || ''); break;
          case 'type': val = (t.type || ''); break;
          case 'entry': val = Number(t.avgEntry || t.entry || 0); break;
          case 'exit': val = Number(t.avgExitPrice || t.exitPrice || 0); break;
          case 'sl': val = Number(t.sl || t.stopLoss || 0); break;
          case 'cmp': val = Number(t.cmp || 0); break;
          case 'pnl': val = Number(t.pnl ?? t.pl ?? 0); break;
          case 'holdingDays': val = Number(t.holdingDays || 0); break;
          case 'date': val = tDate; break;
          case 'hour': val = tDate ? tDate.getHours() : null; break;
          case 'dayOfWeek': val = tDate ? tDate.getDay() : null; break;
          case 'month': val = tDate ? tDate.getMonth() + 1 : null; break;
          case 'year': val = tDate ? tDate.getFullYear() : null; break;
          case 'capitalAtRisk': val = Number(t.capitalAtRisk || 0); break;
          case 'rewardRisk': val = Number(t.rewardRisk ?? t.rMultiple ?? 0); break;
          case 'dateFrom': {
            if (!tDate) return false;
            const fromDate = parseDateFoxy(filter.value);
            if (fromDate) {
              fromDate.setHours(0, 0, 0, 0);
              if (tDate < fromDate) return false;
            }
            continue;
          }
          case 'dateTo': {
            if (!tDate) return false;
            const toDate = parseDateFoxy(filter.value);
            if (toDate) {
              toDate.setHours(23, 59, 59, 999);
              if (tDate > toDate) return false;
            }
            continue;
          }
          default: val = t[filter.field];
        }

        let filterVal = filter.value;

        // Handle exact date comparison
        if (filter.field === 'date') {
          const tDateStr = toDateString(tDate);
          const filterDateObj = parseDateFoxy(filterVal);
          const filterDateStr = filterDateObj ? toDateString(filterDateObj) : String(filterVal).trim().slice(0, 10);

          if (filter.op === 'eq' && tDateStr !== filterDateStr) return false;
          if (filter.op === 'neq' && tDateStr === filterDateStr) return false;
          continue;
        }

        // Handle numeric comparisons (including stringified and currency inputs)
        const isNumericComparison = typeof val === 'number' || 
          ['pnl', 'entry', 'exit', 'sl', 'cmp', 'capitalAtRisk', 'rewardRisk', 'holdingDays', 'hour', 'dayOfWeek', 'month', 'year'].includes(filter.field);

        if (isNumericComparison) {
          const numVal = sanitizeNumeric(val);
          const numFilterVal = sanitizeNumeric(filterVal);

          switch (filter.op) {
            case 'eq': if (numVal !== numFilterVal) return false; break;
            case 'neq': if (numVal === numFilterVal) return false; break;
            case 'gt': if (numVal <= numFilterVal) return false; break;
            case 'lt': if (numVal >= numFilterVal) return false; break;
            case 'gte': if (numVal < numFilterVal) return false; break;
            case 'lte': if (numVal > numFilterVal) return false; break;
            case 'in': if (!Array.isArray(filterVal) || !filterVal.map(sanitizeNumeric).includes(numVal)) return false; break;
          }
          continue;
        }

        // String / default comparisons
        switch (filter.op) {
          case 'eq': if (String(val).toLowerCase() !== String(filterVal).toLowerCase()) return false; break;
          case 'neq': if (String(val).toLowerCase() === String(filterVal).toLowerCase()) return false; break;
          case 'contains': if (String(val).toLowerCase().indexOf(String(filterVal).toLowerCase()) === -1) return false; break;
          case 'gt': if (val <= filterVal) return false; break;
          case 'lt': if (val >= filterVal) return false; break;
          case 'gte': if (val < filterVal) return false; break;
          case 'lte': if (val > filterVal) return false; break;
          case 'in': if (!Array.isArray(filterVal) || !filterVal.includes(val)) return false; break;
        }
      }
      return true;
    });
  }

  // Return individual trade rows if requested
  if (querySpec.returnRows) {
    let rows = filtered.map((t, idx) => ({
      no: idx + 1,
      date: t.date || '-',
      symbol: (t.name || t.symbol || 'DRAFT').toUpperCase(),
      setup: t.setup || '-',
      type: t.type || 'Buy',
      qty: t.openQty || t.qty || 0,
      entry: Math.round(Number(t.avgEntry || t.entry || 0)),
      exit: Math.round(Number(t.avgExitPrice || t.exitPrice || 0)),
      sl: Math.round(Number(t.sl || t.stopLoss || 0)),
      pnl: Math.round(Number(t.pnl ?? t.pl ?? 0)),
      r: (t.rewardRisk !== null && t.rewardRisk !== undefined && !isNaN(Number(t.rewardRisk))) ? Number(t.rewardRisk).toFixed(2) : '-',
      status: t.status || 'Open',
      holdingDays: t.holdingDays || 0
    }));

    if (querySpec.orderBy) {
      const { field, dir } = querySpec.orderBy;
      rows.sort((a, b) => {
        const valA = a[field];
        const valB = b[field];
        if (valA < valB) return dir === 'desc' ? 1 : -1;
        if (valA > valB) return dir === 'desc' ? -1 : 1;
        return 0;
      });
    }

    // Enforce upper bound guard (max 50 rows) to prevent token dump
    const maxLimit = Math.min(querySpec.limit || 25, 50);
    if (rows.length > maxLimit) {
      rows = rows.slice(0, maxLimit);
    }
    return rows;
  }

  // Grouping
  let groups = { 'All': filtered };
  if (querySpec.groupBy) {
    groups = {};
    for (const t of filtered) {
      let gVal = 'Unknown';
      const tDate = parseDateFoxy(t.date);
      switch (querySpec.groupBy) {
        case 'setup': gVal = t.setup || 'None'; break;
        case 'symbol': gVal = (t.name || t.symbol || 'Unknown').toUpperCase(); break;
        case 'segment': gVal = t.segment || 'None'; break;
        case 'status': gVal = t.status || 'Unknown'; break;
        case 'year': gVal = tDate ? String(tDate.getFullYear()) : 'Unknown'; break;
        case 'hour': 
          gVal = tDate ? String(tDate.getHours()) : 'Unknown';
          break;
        case 'month': {
          const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
          gVal = tDate ? monthNames[tDate.getMonth()] : 'Unknown'; 
          break;
        }
        case 'dayOfWeek': {
          const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
          gVal = tDate ? dayNames[tDate.getDay()] : 'Unknown';
          break;
        }
      }
      if (!groups[gVal]) groups[gVal] = [];
      groups[gVal].push(t);
    }
  }

  // Aggregations
  const results = [];
  for (const [gKey, gTrades] of Object.entries(groups)) {
    const row = { group: gKey };
    const count = gTrades.length;
    let wins = 0;
    let losses = 0;
    let totalPnl = 0;
    let totalR = 0;
    let winR = 0;
    let lossR = 0;
    let totalHolding = 0;
    let rCount = 0;
    let grossWin = 0;
    let grossLoss = 0;

    for (const t of gTrades) {
      const pnl = Number(t.pnl ?? t.pl ?? 0);
      totalPnl += pnl;
      if (pnl > 0) {
        wins++;
        grossWin += pnl;
      } else if (pnl < 0) {
        losses++;
        grossLoss += Math.abs(pnl);
      }

      const rr = Number(t.rewardRisk ?? t.rMultiple ?? 0);
      if (rr !== 0 && !isNaN(rr)) {
        totalR += rr;
        rCount++;
        if (rr > 0) winR += rr;
        else lossR += Math.abs(rr);
      }

      const holding = Number(t.holdingDays || 0);
      if (!isNaN(holding)) {
        totalHolding += holding;
      }
    }

    // Chronologically sorted copy for max drawdown and streaks
    let maxDrawdownVal = 0;
    let maxWinStreak = 0;
    let maxLossStreak = 0;

    const requestedAggs = querySpec.aggregations || ['count', 'winRate', 'totalPnl'];
    if (requestedAggs.includes('maxDrawdown') || requestedAggs.includes('streaks')) {
      const sorted = [...gTrades].sort((a, b) => {
        const da = parseDateFoxy(a.date) || 0;
        const db = parseDateFoxy(b.date) || 0;
        return da - db;
      });

      let peakCum = 0;
      let cumPnl = 0;
      let curW = 0, curL = 0;

      for (const t of sorted) {
        const p = Number(t.pnl ?? t.pl ?? 0);
        cumPnl += p;
        if (cumPnl > peakCum) peakCum = cumPnl;
        const shortfall = peakCum - cumPnl;
        if (shortfall > maxDrawdownVal) maxDrawdownVal = shortfall;

        if (p > 0) {
          curW++; curL = 0;
          if (curW > maxWinStreak) maxWinStreak = curW;
        } else if (p < 0) {
          curL++; curW = 0;
          if (curL > maxLossStreak) maxLossStreak = curL;
        }
      }
    }

    for (const agg of requestedAggs) {
      switch (agg) {
        case 'count': row.count = count; break;
        case 'wins': row.wins = wins; break;
        case 'losses': row.losses = losses; break;
        case 'winRate': row.winRate = (wins + losses) > 0 ? Number(((wins / (wins + losses)) * 100).toFixed(1)) : 0; break;
        case 'totalPnl': row.totalPnl = totalPnl; break;
        case 'avgPnl': row.avgPnl = count > 0 ? Number((totalPnl / count).toFixed(2)) : 0; break;
        case 'avgWin': row.avgWin = wins > 0 ? Number((grossWin / wins).toFixed(2)) : 0; break;
        case 'avgLoss': row.avgLoss = losses > 0 ? Number((grossLoss / losses).toFixed(2)) : 0; break;
        case 'totalR': row.totalR = Number(totalR.toFixed(2)); break;
        case 'avgR': row.avgR = rCount > 0 ? Number((totalR / rCount).toFixed(2)) : 0; break;
        case 'profitFactor': row.profitFactor = grossLoss > 0 ? Number((grossWin / grossLoss).toFixed(2)) : (grossWin > 0 ? Infinity : 0); break;
        case 'expectancy': {
          const wRate = (wins + losses) > 0 ? (wins / (wins + losses)) : 0;
          const avgW_R = wins > 0 ? (winR / wins) : 0;
          const avgL_R = losses > 0 ? (lossR / losses) : 0;
          row.expectancy = Number((wRate * avgW_R - (1 - wRate) * avgL_R).toFixed(2));
          break;
        }
        case 'maxDrawdown': row.maxDrawdown = maxDrawdownVal; break;
        case 'streaks': 
          row.maxWinStreak = maxWinStreak;
          row.maxLossStreak = maxLossStreak;
          break;
        case 'avgHolding': row.avgHolding = count > 0 ? Number((totalHolding / count).toFixed(1)) : 0; break;
      }
    }
    results.push(row);
  }

  if (querySpec.orderBy) {
    const { field, dir } = querySpec.orderBy;
    results.sort((a, b) => {
      const valA = a[field];
      const valB = b[field];
      if (valA < valB) return dir === 'desc' ? 1 : -1;
      if (valA > valB) return dir === 'desc' ? -1 : 1;
      return 0;
    });
  }

  if (querySpec.limit && results.length > querySpec.limit) {
    results = results.slice(0, querySpec.limit);
  }

  return results;
}

/**
 * Executes a query and returns a markdown table representation
 */
export function executeQueryAndFormat(trades, querySpec) {
  let results;
  try {
    results = runQuery(trades, querySpec);
  } catch (err) {
    return `Query error: ${err.message}`;
  }
  
  if (!results || results.length === 0) {
    return 'No results found.';
  }

  const columns = Object.keys(results[0]);
  let md = '| ' + columns.join(' | ') + ' |\n';
  md += '| ' + columns.map(() => '---').join(' | ') + ' |\n';

  for (const row of results) {
    const mdRow = [];
    for (const col of columns) {
      let val = row[col];
      if (typeof val === 'number') {
        if (!Number.isInteger(val)) {
          val = val.toFixed(2);
        }
      }
      mdRow.push(val);
    }
    md += '| ' + mdRow.join(' | ') + ' |\n';
  }
  return md;
}
