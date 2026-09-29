/**
 * Indian Number & Currency Formatting Utility
 * 
 * Formats numbers into Indian Numbering System standards:
 * - Lakhs (L): 1,00,000 -> 1L / ₹1L
 * - Crores (Cr): 1,00,00,000 -> 1Cr / ₹1Cr
 * - Thousands (K): 1,000 -> 1K / ₹1K (for compact display)
 * - Exact Indian commas for full values: 12,34,567.89
 */

/**
 * Format a number into full Indian comma notation (e.g. 1,00,00,000.00)
 */
export function formatFullIndianNumber(val, decimals = 2) {
  const num = Number(val);
  if (isNaN(num)) return '0';
  
  const isNegative = num < 0;
  const absVal = Math.abs(num);
  
  const formatted = absVal.toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });

  return isNegative ? `-${formatted}` : formatted;
}

/**
 * Format a number as full Indian Rupee string (e.g. ₹1,25,000.00)
 */
export function formatFullIndianRupee(val, decimals = 2, hideValues = false) {
  if (hideValues) return '••••••';
  const num = Number(val);
  if (isNaN(num) || num === 0) return '₹0.00';
  
  const isNegative = num < 0;
  const absFormatted = Math.abs(num).toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });

  return isNegative ? `-₹${absFormatted}` : `₹${absFormatted}`;
}

/**
 * Format a number using Lakhs (L) and Crores (Cr) abbreviation standards
 * Examples:
 *  100000 -> 1L
 *  10000000 -> 1Cr
 *  1250000 -> 12.5L
 *  25400000 -> 2.54Cr
 *  1500 -> 1.5K
 *  450 -> 450
 */
export function formatIndianNumber(val, options = {}) {
  const {
    decimals = 2,
    hideValues = false,
    showPositiveSign = false,
    suffix = ''
  } = options;

  if (hideValues) return '••••••';
  
  const num = Number(val);
  if (isNaN(num)) return `0${suffix}`;
  if (num === 0) return `0${suffix}`;

  const isNegative = num < 0;
  const absVal = Math.abs(num);
  let formatted = '';
  let unit = '';

  if (absVal >= 10000000) {
    // 1 Crore = 10,000,000
    const inCr = absVal / 10000000;
    formatted = inCr.toFixed(decimals).replace(/\.?0+$/, '');
    unit = 'Cr';
  } else if (absVal >= 100000) {
    // 1 Lakh = 100,000
    const inLakh = absVal / 100000;
    formatted = inLakh.toFixed(decimals).replace(/\.?0+$/, '');
    unit = 'L';
  } else {
    // Below 1 Lakh (e.g. thousands, hundreds): format with Indian commas without K abbreviation
    const hasDecimals = absVal % 1 !== 0;
    formatted = absVal.toLocaleString('en-IN', {
      minimumFractionDigits: hasDecimals ? Math.min(decimals, 2) : 0,
      maximumFractionDigits: decimals
    });
  }

  const sign = isNegative ? '-' : (showPositiveSign ? '+' : '');
  return `${sign}${formatted}${unit}${suffix}`;
}

/**
 * Format Indian Rupee currency with Lakhs & Crores abbreviations starting from 1 Lakh
 * Examples:
 *  100000 -> ₹1L
 *  10000000 -> ₹1Cr
 *  -100000 -> -₹1L
 *  -10000000 -> -₹1Cr
 *  1250000 -> ₹12.5L
 *  45200 -> ₹45,200 (No K, standard Indian comma formatting)
 *  450 -> ₹450
 */
export function formatIndianRupee(val, options = {}) {
  const {
    decimals = 2,
    hideValues = false,
    compact = true,
    showPositiveSign = false
  } = options;

  if (hideValues) return '••••••';
  
  const num = Number(val);
  if (isNaN(num) || num === 0) return '₹0';

  const isNegative = num < 0;
  const absVal = Math.abs(num);

  if (!compact) {
    return formatFullIndianRupee(val, decimals, hideValues);
  }

  let formatted = '';
  let unit = '';

  if (absVal >= 10000000) {
    // >= 1 Crore
    const inCr = absVal / 10000000;
    formatted = inCr.toFixed(decimals).replace(/\.?0+$/, '');
    unit = 'Cr';
  } else if (absVal >= 100000) {
    // >= 1 Lakh
    const inLakh = absVal / 100000;
    formatted = inLakh.toFixed(decimals).replace(/\.?0+$/, '');
    unit = 'L';
  } else {
    // Below 1 Lakh (e.g. thousands, hundreds): standard Indian commas without K abbreviation
    const hasDecimals = absVal % 1 !== 0;
    formatted = absVal.toLocaleString('en-IN', {
      minimumFractionDigits: hasDecimals ? Math.min(decimals, 2) : 0,
      maximumFractionDigits: decimals
    });
  }

  const signPrefix = isNegative ? '-₹' : (showPositiveSign ? '+₹' : '₹');
  return `${signPrefix}${formatted}${unit}`;
}

/**
 * Return detailed breakdown object for tooltips, micro-matrices, and badges
 */
export function getIndianValueMeta(val, hideValues = false) {
  const num = Number(val) || 0;
  return {
    raw: num,
    isNegative: num < 0,
    isPositive: num > 0,
    isZero: num === 0,
    compact: formatIndianRupee(num, { hideValues }),
    compactNoSymbol: formatIndianNumber(num, { hideValues }),
    full: formatFullIndianRupee(num, 2, hideValues),
    fullNumber: formatFullIndianNumber(num, 2)
  };
}

export default {
  formatIndianRupee,
  formatIndianNumber,
  formatFullIndianRupee,
  formatFullIndianNumber,
  getIndianValueMeta
};
