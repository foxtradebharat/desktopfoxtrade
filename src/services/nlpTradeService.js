/**
 * NLP & WhatsApp Shorthand Trade Parser Service
 * 
 * Understands natural conversational Indian English & trader shorthand:
 * Examples:
 * - "Sold NIFTY 23200 CE at 285. Entry was 210. FOMO trade"
 * - "s nifty 23200CE 285 210 FOMO"
 * - "Bought 100 TATASTEEL at 165 sold at 178 Breakout Setup"
 * - "banknifty 51500 pe bought 2 lots @ 340 exited 410 target achieved"
 * - "RELIANCE buy 25 qty 2950 sl 2900 tp 3050"
 */

const LOT_SIZES = {
  'NIFTY': 50,
  'BANKNIFTY': 15,
  'FINNIFTY': 25,
  'MIDCPNIFTY': 50,
  'SENSEX': 10,
  'BANKEX': 15
};

// Helper: Today's date in DD-MM-YYYY format (IST)
function getTodayIST() {
  return new Date().toLocaleDateString('en-IN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    timeZone: 'Asia/Kolkata'
  }).replace(/\//g, '-');
}

/**
 * Parse raw conversational message into a structured Trade object
 */
export function parseNaturalTradeMessage(input = '') {
  if (!input || !input.trim()) return null;

  const text = input.trim();

  // 1. Detect Action (BUY / SELL / LONG / SHORT)
  let action = 'BUY';
  let side = 'LONG';
  if (/^(s\b|sold|short|sell)/i.test(text) || /\b(sold|shorted|sell|pe buy)\b/i.test(text)) {
    if (/\b(bought|long|b\b)\b/i.test(text) && /\b(sold|exited|s\b)\b/i.test(text)) {
      // "Bought at X sold at Y" -> It's a completed Long trade
      action = 'BUY';
      side = 'LONG';
    } else if (/^(s\b|sold|short|sell)/i.test(text)) {
      action = 'SELL';
      side = 'SHORT';
    }
  }

  // 2. Detect Symbol & Option Strike (e.g. NIFTY 23200 CE, BANKNIFTY 51500 PE, TATASTEEL)
  let symbol = 'UNKNOWN';
  let instrumentType = 'Equity';
  let strike = '';
  let optionType = '';

  const optMatch = text.match(/\b(NIFTY|BANKNIFTY|FINNIFTY|MIDCPNIFTY|SENSEX)\s*([0-9]{4,6})?\s*(CE|PE|CALL|PUT)\b/i);
  if (optMatch) {
    const baseIndex = optMatch[1].toUpperCase();
    strike = optMatch[2] || '';
    optionType = (optMatch[3].toUpperCase().startsWith('C')) ? 'CE' : 'PE';
    symbol = `${baseIndex} ${strike ? strike + ' ' : ''}${optionType}`;
    instrumentType = 'Options';
  } else {
    // Look for stock ticker or index name
    const stockMatch = text.match(/\b(NIFTY|BANKNIFTY|FINNIFTY|SENSEX|TATASTEEL|TATAMOTORS|RELIANCE|HDFCBANK|ICICIBANK|INFY|SBIN|LT|ITC|BHARTIARTL|KOTAKBANK|MARUTI|TITAN|BAJFINANCE|ASIANPAINT|ADANIENT|TCS|WIPRO|[A-Z]{3,12})\b/i);
    if (stockMatch) {
      symbol = stockMatch[1].toUpperCase();
      if (['NIFTY', 'BANKNIFTY', 'FINNIFTY', 'SENSEX'].includes(symbol)) {
        instrumentType = 'Futures';
      } else {
        instrumentType = 'Equity';
      }
    }
  }

  // 3. Detect Quantities / Lots
  let qty = 1;
  const lotsMatch = text.match(/([0-9]+)\s*(lots?|lot)\b/i);
  const qtyMatch = text.match(/([0-9]+)\s*(qty|shares?|units?|quantity)\b/i);

  const baseSymbol = symbol.split(' ')[0];
  const lotUnit = LOT_SIZES[baseSymbol] || 1;

  if (lotsMatch) {
    const numLots = parseInt(lotsMatch[1], 10);
    qty = numLots * lotUnit;
  } else if (qtyMatch) {
    qty = parseInt(qtyMatch[1], 10);
  } else if (lotUnit > 1 && instrumentType === 'Options') {
    qty = lotUnit; // default to 1 standard lot
  } else {
    // Look for loose numbers that could be quantity before stock name
    const looseQty = text.match(/\b(?:bought|sold|buy|sell)\s+([0-9]{1,4})\s+[A-Za-z]/i);
    if (looseQty) {
      qty = parseInt(looseQty[1], 10);
    } else {
      qty = (instrumentType === 'Equity') ? 50 : lotUnit;
    }
  }

  // 4. Detect Prices (Entry, Exit, CMP, StopLoss, Target)
  let entryPrice = 0;
  let exitPrice = 0;
  let stopLoss = 0;
  let target = 0;

  // Patterns for explicit entry/exit
  const entryMatch = text.match(/\b(?:entry|bought at|entered at|buy at|entry was|@)\s*([0-9]+(?:\.[0-9]+)?)/i);
  const exitMatch = text.match(/\b(?:exit|sold at|exited at|sell at|exit was|closed at|tp hit at)\s*([0-9]+(?:\.[0-9]+)?)/i);
  const slMatch = text.match(/\b(?:sl|stoploss|stop loss)\s*(?:was|at|:)?\s*([0-9]+(?:\.[0-9]+)?)/i);
  const tgtMatch = text.match(/\b(?:tp|target|tgt)\s*(?:was|at|:)?\s*([0-9]+(?:\.[0-9]+)?)/i);

  if (entryMatch) entryPrice = parseFloat(entryMatch[1]);
  if (exitMatch) exitPrice = parseFloat(exitMatch[1]);
  if (slMatch) stopLoss = parseFloat(slMatch[1]);
  if (tgtMatch) target = parseFloat(tgtMatch[1]);

  // Shorthand format: "s nifty 23200CE 285 210" -> exit=285, entry=210
  if (!entryPrice && !exitPrice) {
    const numbers = text.match(/\b([0-9]{2,6}(?:\.[0-9]+)?)\b/g);
    if (numbers && numbers.length >= 2) {
      // Exclude strike price if present
      const filteredNumbers = numbers.filter(n => n !== strike).map(Number);
      if (filteredNumbers.length >= 2) {
        if (action === 'SELL' || side === 'SHORT') {
          exitPrice = filteredNumbers[0];
          entryPrice = filteredNumbers[1];
        } else {
          entryPrice = filteredNumbers[0];
          exitPrice = filteredNumbers[1];
        }
      } else if (filteredNumbers.length === 1) {
        entryPrice = filteredNumbers[0];
      }
    }
  }

  // Fallback defaults if not fully specified
  if (!entryPrice && exitPrice) entryPrice = exitPrice * 0.95;
  if (!entryPrice) entryPrice = 100;

  // 5. Detect Emotion Tags & Setups
  const emotionsList = ['FOMO', 'Greed', 'Fear', 'Revenge', 'Calm', 'Disciplined', 'Overconfidence', 'Hesitation', 'Rushed'];
  const matchedEmotions = emotionsList.filter(e => new RegExp(`\\b${e}\\b`, 'i').test(text));
  const emotion = matchedEmotions.length > 0 ? matchedEmotions[0] : 'Disciplined';

  const setupsList = ['Breakout', 'Pullback', 'CPR Reversal', 'VWAP Bounce', 'ORB (Opening Range)', 'Gap Fill', 'Support/Resistance', 'Expiry Scalp', 'Trend Following'];
  const matchedSetups = setupsList.filter(s => new RegExp(`\\b${s.split(' ')[0]}\\b`, 'i').test(text));
  const setup = matchedSetups.length > 0 ? matchedSetups[0] : 'Price Action';

  // 6. Calculate P&L and Trade Status
  const status = exitPrice > 0 ? 'Closed' : 'Open';
  let pnl = 0;
  let pnlPct = 0;

  if (status === 'Closed') {
    if (side === 'SHORT') {
      pnl = (entryPrice - exitPrice) * qty;
    } else {
      pnl = (exitPrice - entryPrice) * qty;
    }
    pnlPct = entryPrice > 0 ? ((exitPrice - entryPrice) / entryPrice) * 100 : 0;
  }

  return {
    id: 'trade_' + Date.now(),
    name: symbol,
    symbol: symbol,
    type: action,
    direction: side,
    instrumentType: instrumentType,
    status: status,
    date: getTodayIST(),
    entryTime: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false }),
    exitTime: status === 'Closed' ? new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false }) : '',
    qty: qty,
    avgEntry: entryPrice,
    avgExit: exitPrice || null,
    pnl: Math.round(pnl * 100) / 100,
    pnlPct: Math.round(pnlPct * 100) / 100,
    stopLoss: stopLoss || (entryPrice * 0.95),
    target: target || (entryPrice * 1.1),
    setup: setup,
    emotion: emotion,
    notes: text,
    source: 'WhatsApp / Quick-Log'
  };
}
