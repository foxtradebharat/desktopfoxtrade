import defaultNews from '../data/foxtradeAuthenticNews.js';

const DHAN_LIVE_NEWS_URL = 'https://news-live.dhan.co/v3/news/getLiveNews';

function formatRelativeTime(timestamp) {
  if (!timestamp) return 'Just now';
  const now = Date.now();
  const diff = now - Number(timestamp);
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function detectCategory(subCategory = '', title = '', category = '') {
  const sub = (subCategory || '').toLowerCase();
  const cat = (category || '').toLowerCase();
  const text = (title || '').toLowerCase();

  if (
    sub.includes('earning') ||
    sub.includes('financial-result') ||
    text.includes('results') ||
    text.includes('q1') ||
    text.includes('q2') ||
    text.includes('q3') ||
    text.includes('q4') ||
    text.includes('revenue') ||
    text.includes('profit') ||
    text.includes('pat')
  ) {
    return 'Earnings';
  }

  if (
    sub.includes('corporate-action') ||
    sub.includes('dividend') ||
    sub.includes('bonus') ||
    sub.includes('split') ||
    sub.includes('buyback') ||
    sub.includes('rights') ||
    sub.includes('venture-capital') ||
    text.includes('dividend') ||
    text.includes('stake') ||
    text.includes('warrant') ||
    text.includes('raises') ||
    text.includes('acquisition') ||
    text.includes('acquires') ||
    text.includes('buys')
  ) {
    return 'Corporate Action';
  }

  if (
    sub.includes('board') ||
    sub.includes('agm') ||
    sub.includes('governance') ||
    sub.includes('appointment') ||
    sub.includes('resignation') ||
    text.includes('agm') ||
    text.includes('board') ||
    text.includes('director') ||
    text.includes('auditor') ||
    text.includes('cfo') ||
    text.includes('ceo')
  ) {
    return 'Corporate Governance';
  }

  if (
    sub.includes('ipo') ||
    text.includes('ipo') ||
    text.includes('drhp') ||
    text.includes('listing') ||
    text.includes('public offering')
  ) {
    return 'Ipo';
  }

  if (
    cat.includes('macro') ||
    cat.includes('global') ||
    sub.includes('global') ||
    text.includes('fed') ||
    text.includes('us ') ||
    text.includes('crude') ||
    text.includes('oil') ||
    text.includes('yield') ||
    text.includes('rupee') ||
    text.includes('dollar') ||
    text.includes('bond')
  ) {
    return 'Global';
  }

  return 'Stock';
}

export async function fetchLiveIndianCorporateNews() {
  try {
    const res = await fetch(DHAN_LIVE_NEWS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/plain, */*'
      },
      body: JSON.stringify({
        categories: ['ALL'],
        page_no: 0,
        limit: 100,
        first_news_timeStamp: 0,
        last_news_timeStamp: 0,
        news_feed_type: 'live',
        entity_id: '',
        stock_list: []
      })
    });

    if (!res.ok) {
      throw new Error(`Dhan HTTP error: ${res.status}`);
    }

    const json = await res.json();
    const rawList = json?.data?.latest_news;

    if (!Array.isArray(rawList) || rawList.length === 0) {
      return defaultNews;
    }

    // Map raw Dhan items matching FoxTrade News Feed structure
    const mapped = rawList.map((item, idx) => {
      const symbol = (item.sm_symbol || item.display_symbol || '').trim();
      const title = item.news_object?.title || '';
      const desc = item.news_object?.text || '';
      const sentiment = item.news_object?.overall_sentiment || 'positive';
      const publishDate = item.publish_date || Date.now();
      const category = detectCategory(item.sub_category, title, item.category);

      // Check if fallback has pricing info for this symbol
      const fallbackMatch = defaultNews.find(f => f.symbol === symbol && f.price);

      let logoUrl = `https://images.dhan.co/symbol/${encodeURIComponent(symbol)}.png`;
      if (!symbol || symbol === 'swish ai' || symbol.toLowerCase().includes('technologies')) {
        logoUrl = 'https://s3-symbol-logo.tradingview.com/country/IN.svg';
      }

      return {
        id: item.article_id > 0 ? `dhan-${item.article_id}` : `dhan-${publishDate}-${idx}`,
        symbol: symbol,
        title: title,
        desc: desc,
        time: formatRelativeTime(publishDate),
        publishDate: publishDate,
        sentiment: sentiment,
        category: category,
        logo: logoUrl,
        price: fallbackMatch?.price || null,
        changePct: fallbackMatch?.changePct || null,
        isPositive: fallbackMatch ? fallbackMatch.isPositive : true
      };
    });

    return mapped;
  } catch (error) {
    console.warn('[dhanNewsService] Live fetch failed, using authentic dataset:', error);
    return defaultNews.map((item, idx) => ({
      ...item,
      id: `fallback-${idx}`,
      category: detectCategory('', item.title, '')
    }));
  }
}
