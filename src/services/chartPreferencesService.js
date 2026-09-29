/**
 * chartPreferencesService.js
 * 
 * Synchronizes chart visualization settings (candle colors, candle types, wick/border styles)
 * across the entire FoxTrade application:
 * - Stock Charts Studio (StockChartsPage)
 * - Sectional Active Stock Cards (ActiveStockChartCard)
 * - Benchmark Index Timeline Chart (BenchmarkIndexChart)
 */

export const STORAGE_KEY_SETTINGS = 'foxtrade_stock_chart_settings';
export const STORAGE_KEY_TYPE = 'foxtrade_stock_chart_type';
export const EVENT_PREFERENCES_CHANGED = 'foxtrade_chart_settings_changed';

export const DEFAULT_PREFERENCES = {
  chartType: 'hollow_candles', // 'candles' | 'bars' | 'hollow_candles'
  settings: {
    upColor: '#131722',
    downColor: '#131722',
    borderUpColor: '#131722',
    borderDownColor: '#131722',
    wickUpColor: '#131722',
    wickDownColor: '#131722',
    bodyVisible: true,
    borderVisible: true,
    wickVisible: true,
    vertGridVisible: false,
    horzGridVisible: false,
  }
};

export function getGlobalChartPreferences() {
  let chartType = DEFAULT_PREFERENCES.chartType;
  let settings = { ...DEFAULT_PREFERENCES.settings };

  try {
    const savedType = localStorage.getItem(STORAGE_KEY_TYPE);
    if (savedType) chartType = savedType;

    const savedSettings = localStorage.getItem(STORAGE_KEY_SETTINGS);
    if (savedSettings) {
      const parsed = JSON.parse(savedSettings);
      settings = {
        ...settings,
        ...parsed,
        upColor: parsed.upColor || settings.upColor,
        downColor: parsed.downColor || settings.downColor,
        borderUpColor: parsed.borderUpColor || parsed.upColor || settings.borderUpColor,
        borderDownColor: parsed.borderDownColor || parsed.downColor || settings.borderDownColor,
        wickUpColor: parsed.wickUpColor || parsed.upColor || settings.wickUpColor,
        wickDownColor: parsed.wickDownColor || parsed.downColor || settings.wickDownColor,
        bodyVisible: parsed.bodyVisible !== false,
        borderVisible: parsed.borderVisible !== false,
        wickVisible: parsed.wickVisible !== false,
      };
    }
  } catch (e) {
    console.warn('Error reading global chart preferences:', e);
  }

  return { chartType, settings };
}

export function setGlobalChartType(newType) {
  try {
    localStorage.setItem(STORAGE_KEY_TYPE, newType);
    const prefs = getGlobalChartPreferences();
    window.dispatchEvent(new CustomEvent(EVENT_PREFERENCES_CHANGED, { detail: prefs }));
  } catch (e) {
    console.warn('Error saving global chart type:', e);
  }
}

export function setGlobalChartSettings(newSettings) {
  try {
    localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(newSettings));
    const prefs = getGlobalChartPreferences();
    window.dispatchEvent(new CustomEvent(EVENT_PREFERENCES_CHANGED, { detail: prefs }));
  } catch (e) {
    console.warn('Error saving global chart settings:', e);
  }
}

export function subscribeChartPreferences(callback) {
  const handler = () => {
    callback(getGlobalChartPreferences());
  };

  window.addEventListener(EVENT_PREFERENCES_CHANGED, handler);
  window.addEventListener('storage', handler);

  return () => {
    window.removeEventListener(EVENT_PREFERENCES_CHANGED, handler);
    window.removeEventListener('storage', handler);
  };
}
