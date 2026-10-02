/**
 * FoxTrade Market Timing Service
 * 
 * Handles Indian (NSE, BSE, MCX) and US equity markets with full holiday awareness,
 * special trading sessions (Muhurat, Union Budget), pre-market, opening soon,
 * and high-precision countdown timers.
 */

// 1. Comprehensive Indian Market Holidays Calendar (NSE / BSE / MCX / Settlement)
export const INDIAN_HOLIDAYS = [
  { date: '2026-01-01', holiday: "New Year's Day", exchanges: ['mcx'], type: 'trading', description: 'MCX Evening session closed', mcxStatus: { morning: true, evening: false } },
  { date: '2026-01-15', holiday: 'Municipal Corporation Elections in Maharashtra', exchanges: ['nse', 'bse', 'mcx'], type: 'trading', description: 'Market closed for Municipal Corporation Elections', mcxStatus: { morning: false, evening: true } },
  { date: '2026-01-26', holiday: 'Republic Day', exchanges: ['nse', 'bse', 'mcx'], type: 'trading', description: 'Market closed for Republic Day', mcxStatus: { morning: false, evening: false } },
  { date: '2026-02-01', holiday: 'Union Budget', exchanges: ['nse', 'bse', 'mcx'], type: 'trading', description: 'Special trading session for Union Budget on Sunday' },
  { date: '2026-02-15', holiday: 'Maha Shivaratri', exchanges: ['nse', 'bse', 'mcx'], type: 'weekend', description: 'Holiday falls on Sunday' },
  { date: '2026-02-19', holiday: 'Chhatrapati Shivaji Maharaj Jayanti', exchanges: ['settlement'], type: 'settlement', description: 'Settlement holiday' },
  { date: '2026-03-03', holiday: 'Holi', exchanges: ['nse', 'bse', 'mcx'], type: 'trading', description: 'Market closed for Holi festival', mcxStatus: { morning: false, evening: true } },
  { date: '2026-03-21', holiday: 'Eid-Ul-Fitr (Ramzan Eid)', exchanges: ['nse', 'bse', 'mcx'], type: 'weekend', description: 'Holiday falls on Saturday' },
  { date: '2026-03-26', holiday: 'Shri Ram Navami', exchanges: ['nse', 'bse', 'mcx'], type: 'trading', description: 'Market closed for Shri Ram Navami', mcxStatus: { morning: false, evening: true } },
  { date: '2026-03-31', holiday: 'Shri Mahavir Jayanti', exchanges: ['nse', 'bse', 'mcx'], type: 'trading', description: 'Market closed for Shri Mahavir Jayanti', mcxStatus: { morning: false, evening: true } },
  { date: '2026-04-01', holiday: 'Annual Bank closing', exchanges: ['settlement'], type: 'settlement', description: 'Settlement holiday' },
  { date: '2026-04-03', holiday: 'Good Friday', exchanges: ['nse', 'bse', 'mcx'], type: 'trading', description: 'Market closed for Good Friday', mcxStatus: { morning: false, evening: false } },
  { date: '2026-04-14', holiday: 'Dr. Baba Saheb Ambedkar Jayanti', exchanges: ['nse', 'bse', 'mcx'], type: 'trading', description: 'Market closed for Dr. Baba Saheb Ambedkar Jayanti', mcxStatus: { morning: false, evening: true } },
  { date: '2026-05-01', holiday: 'Maharashtra Day', exchanges: ['nse', 'bse', 'mcx'], type: 'trading', description: 'Market closed for Maharashtra Day', mcxStatus: { morning: false, evening: true } },
  { date: '2026-05-28', holiday: 'Bakri Eid', exchanges: ['nse', 'bse', 'mcx'], type: 'trading', description: 'Market closed for Bakri Eid', mcxStatus: { morning: false, evening: true } },
  { date: '2026-06-26', holiday: 'Moharram', exchanges: ['nse', 'bse', 'mcx'], type: 'trading', description: 'Market closed for Moharram', mcxStatus: { morning: false, evening: true } },
  { date: '2026-08-15', holiday: 'Independence Day', exchanges: ['nse', 'bse', 'mcx'], type: 'weekend', description: 'Holiday falls on Saturday' },
  { date: '2026-08-27', holiday: 'Id-E-Milad', exchanges: ['settlement'], type: 'settlement', description: 'Settlement holiday' },
  { date: '2026-09-14', holiday: 'Ganesh Chaturthi', exchanges: ['nse', 'bse', 'mcx'], type: 'trading', description: 'Market closed for Ganesh Chaturthi', mcxStatus: { morning: false, evening: true } },
  { date: '2026-10-02', holiday: 'Mahatma Gandhi Jayanti', exchanges: ['nse', 'bse', 'mcx'], type: 'trading', description: 'Market closed for Mahatma Gandhi Jayanti', mcxStatus: { morning: false, evening: false } },
  { date: '2026-10-20', holiday: 'Dussehra', exchanges: ['nse', 'bse', 'mcx'], type: 'trading', description: 'Market closed for Dussehra', mcxStatus: { morning: false, evening: true } },
  { date: '2026-11-08', holiday: 'Diwali-Laxmi Pujan (Muhurat trading session)', exchanges: ['nse', 'bse', 'mcx'], type: 'trading', description: 'Muhurat trading session for Diwali (timings to be notified)', mcxStatus: { morning: false, evening: false } },
  { date: '2026-11-10', holiday: 'Diwali-Balipratipada', exchanges: ['nse', 'bse', 'mcx'], type: 'trading', description: 'Market closed for Diwali-Balipratipada', mcxStatus: { morning: false, evening: true } },
  { date: '2026-11-24', holiday: 'Prakash Gurpurb Sri Guru Nanak Dev', exchanges: ['nse', 'bse', 'mcx'], type: 'trading', description: 'Market closed for Guru Nanak Jayanti', mcxStatus: { morning: false, evening: true } },
  { date: '2026-12-25', holiday: 'Christmas', exchanges: ['nse', 'bse', 'mcx'], type: 'trading', description: 'Market closed for Christmas', mcxStatus: { morning: false, evening: false } }
];

// 2. Comprehensive US Market Holidays Calendar (NYSE / NASDAQ)
export const US_HOLIDAYS = [
  { date: '2026-01-01', holiday: "New Year's Day", exchanges: ['nyse', 'nasdaq'], type: 'trading', description: 'US stock market closed' },
  { date: '2026-01-19', holiday: 'Martin Luther King Jr. Day', exchanges: ['nyse', 'nasdaq'], type: 'trading', description: 'US stock market closed' },
  { date: '2026-02-16', holiday: "Presidents' Day", exchanges: ['nyse', 'nasdaq'], type: 'trading', description: 'US stock market closed' },
  { date: '2026-04-03', holiday: 'Good Friday', exchanges: ['nyse', 'nasdaq'], type: 'trading', description: 'US stock market closed' },
  { date: '2026-05-25', holiday: 'Memorial Day', exchanges: ['nyse', 'nasdaq'], type: 'trading', description: 'US stock market closed' },
  { date: '2026-06-19', holiday: 'Juneteenth', exchanges: ['nyse', 'nasdaq'], type: 'trading', description: 'US stock market closed' },
  { date: '2026-07-03', holiday: 'Independence Day (observed)', exchanges: ['nyse', 'nasdaq'], type: 'trading', description: 'US stock market closed' },
  { date: '2026-09-07', holiday: 'Labor Day', exchanges: ['nyse', 'nasdaq'], type: 'trading', description: 'US stock market closed' },
  { date: '2026-11-26', holiday: 'Thanksgiving Day', exchanges: ['nyse', 'nasdaq'], type: 'trading', description: 'US stock market closed' },
  { date: '2026-11-27', holiday: 'Day after Thanksgiving', exchanges: ['nyse', 'nasdaq'], type: 'early-close', description: 'US stock market early close at 1:00 PM ET', earlyCloseTime: { hour: 13, minute: 0, timeZone: 'America/New_York' } },
  { date: '2026-12-24', holiday: 'Christmas Eve', exchanges: ['nyse', 'nasdaq'], type: 'early-close', description: 'US stock market early close at 1:00 PM ET', earlyCloseTime: { hour: 13, minute: 0, timeZone: 'America/New_York' } },
  { date: '2026-12-25', holiday: 'Christmas Day', exchanges: ['nyse', 'nasdaq'], type: 'trading', description: 'US stock market closed' }
];

export class MarketHolidayService {
  static holidays = INDIAN_HOLIDAYS;
  static usHolidays = US_HOLIDAYS;

  static getHolidays(market = 'india') {
    return market === 'us' ? this.usHolidays : this.holidays;
  }

  static getTimeZone(market = 'india') {
    return market === 'us' ? 'America/New_York' : 'Asia/Kolkata';
  }

  static formatDateInTimeZone(date, timeZone) {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).formatToParts(date);
    const obj = Object.fromEntries(parts.map(p => [p.type, p.value]));
    return `${obj.year}-${obj.month}-${obj.day}`;
  }

  static dateKeyToUtcMs(key) {
    const [y, m, d] = key.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  }

  static getUpcomingHolidays(days = 14, market = 'india') {
    const tz = this.getTimeZone(market);
    const todayKey = this.formatDateInTimeZone(new Date(), tz);
    const todayMs = this.dateKeyToUtcMs(todayKey);

    return this.getHolidays(market)
      .map(h => {
        const diffMs = this.dateKeyToUtcMs(h.date) - todayMs;
        const daysUntil = Math.ceil(diffMs / (24 * 60 * 60 * 1000));
        return {
          holiday: h,
          daysUntil,
          isToday: daysUntil === 0,
          isTomorrow: daysUntil === 1
        };
      })
      .filter(h => h.daysUntil >= 0 && h.daysUntil <= days)
      .sort((a, b) => a.daysUntil - b.daysUntil);
  }

  static getNextHoliday(market = 'india') {
    const upcoming = this.getUpcomingHolidays(60, market);
    return upcoming.length > 0 ? upcoming[0] : null;
  }

  static isHoliday(date, market = 'india') {
    const tz = this.getTimeZone(market);
    const key = this.formatDateInTimeZone(date, tz);
    return this.getHolidays(market).find(h => h.date === key) || null;
  }

  static getHolidayMessage(holiday, daysUntil) {
    const exchanges = (holiday.exchanges || []).map(e => e.toUpperCase()).join(', ');
    const term = holiday.type === 'early-close' ? 'early close' : 'holiday';
    if (daysUntil === 0) return `Today is ${holiday.holiday} - Market closed for ${exchanges}`;
    if (daysUntil === 1) return `Tomorrow is ${holiday.holiday} - Market closed for ${exchanges}`;
    return `${holiday.holiday} in ${daysUntil} days - Market ${term} for ${exchanges}`;
  }
}

export class MarketTimingService {
  static US_TIME_ZONE = 'America/New_York';
  static IST_TIME_ZONE = 'Asia/Kolkata';

  static REGULAR_SESSIONS = [
    { name: 'Pre-Market', startTime: { hour: 9, minute: 0 }, endTime: { hour: 9, minute: 8 } },
    { name: 'Market Opening Soon', startTime: { hour: 9, minute: 8 }, endTime: { hour: 9, minute: 15 } },
    { name: 'Regular Trading', startTime: { hour: 9, minute: 15 }, endTime: { hour: 15, minute: 30 } }
  ];

  static MCX_SESSIONS = [
    { name: 'Special Session (Pre-open)', startTime: { hour: 8, minute: 45 }, endTime: { hour: 8, minute: 59 } },
    { name: 'Morning Session', startTime: { hour: 9, minute: 0 }, endTime: { hour: 17, minute: 0 } },
    { name: 'Evening Session', startTime: { hour: 17, minute: 0 }, endTime: { hour: 23, minute: 30 } }
  ];

  static US_EQUITY_SESSIONS = [
    { name: 'Pre-Market', startTime: { hour: 4, minute: 0 }, endTime: { hour: 9, minute: 30 } },
    { name: 'Regular Trading', startTime: { hour: 9, minute: 30 }, endTime: { hour: 16, minute: 0 } },
    { name: 'After-Hours', startTime: { hour: 16, minute: 0 }, endTime: { hour: 20, minute: 0 } }
  ];

  static TRADING_DAYS = [1, 2, 3, 4, 5]; // Mon to Fri

  static getZonedParts(date, timeZone) {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }).formatToParts(date);
    const obj = Object.fromEntries(parts.map(p => [p.type, p.value]));
    return {
      year: Number(obj.year),
      month: Number(obj.month),
      day: Number(obj.day),
      hour: Number(obj.hour),
      minute: Number(obj.minute),
      second: Number(obj.second)
    };
  }

  static formatDateKey(p) {
    return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
  }

  static addDaysToDateKey(key, days) {
    const [y, m, d] = key.split('-').map(Number);
    const date = new Date(Date.UTC(y, m - 1, d + days));
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
  }

  static getDayOfWeekFromDateKey(key) {
    const [y, m, d] = key.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  }

  static dateKeyToNoonUtcDate(key) {
    const [y, m, d] = key.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d, 12, 0, 0, 0));
  }

  static getTimeZoneOffsetMs(date, timeZone) {
    const p = this.getZonedParts(date, timeZone);
    return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - date.getTime();
  }

  static zonedDateTimeToUtcMs(dateKey, time, timeZone) {
    const [y, m, d] = dateKey.split('-').map(Number);
    const targetMs = Date.UTC(y, m - 1, d, time.hour, time.minute, 0, 0);
    const offset1 = this.getTimeZoneOffsetMs(new Date(targetMs), timeZone);
    const approxUtc = targetMs - offset1;
    const offset2 = this.getTimeZoneOffsetMs(new Date(approxUtc), timeZone);
    return targetMs - offset2;
  }

  static getHolidaySession(holiday) {
    if (!holiday || !holiday.holiday) return null;
    const name = holiday.holiday.toLowerCase();
    if (name.includes('muhurat')) {
      return { name: 'Muhurat Trading', startTime: { hour: 18, minute: 0 }, endTime: { hour: 19, minute: 15 } };
    }
    if (name.includes('union budget')) {
      return { name: 'Budget Session', startTime: { hour: 9, minute: 0 }, endTime: { hour: 15, minute: 30 } };
    }
    return null;
  }

  static formatCountdown(ms) {
    if (ms <= 0) return '0s';
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  }

  static getNextTradingDateKey(baseDate, market = 'india') {
    const tz = market === 'us' ? this.US_TIME_ZONE : this.IST_TIME_ZONE;
    let currKey = this.formatDateKey(this.getZonedParts(baseDate, tz));

    for (let i = 0; i < 30; i++) {
      currKey = this.addDaysToDateKey(currKey, 1);
      const dow = this.getDayOfWeekFromDateKey(currKey);
      const noonDate = this.dateKeyToNoonUtcDate(currKey);
      const hol = MarketHolidayService.isHoliday(noonDate, market);

      // Union Budget on weekend is allowed
      if (hol?.holiday === 'Union Budget') return currKey;

      if (this.TRADING_DAYS.includes(dow) && hol?.type !== 'trading') {
        return currKey;
      }
    }
    return currKey;
  }

  /**
   * Main Market Status Engine
   * Exactly calculates live status, current session, next session countdown,
   * holiday flags, and user-facing messages.
   */
  static getMarketStatus(segment = 'equity', market = 'india') {
    const now = new Date();
    const tz = market === 'us' ? this.US_TIME_ZONE : this.IST_TIME_ZONE;
    const parts = this.getZonedParts(now, tz);
    const todayKey = this.formatDateKey(parts);
    const curMinuteOfDay = parts.hour * 60 + parts.minute;
    const dow = this.getDayOfWeekFromDateKey(todayKey);

    const holiday = MarketHolidayService.isHoliday(this.dateKeyToNoonUtcDate(todayKey), market);
    const isBudgetSunday = holiday?.holiday === 'Union Budget';
    const isWeekend = !this.TRADING_DAYS.includes(dow) && !isBudgetSunday;
    const isHolidayToday = !!holiday && holiday.type === 'trading' && !isBudgetSunday;

    // Determine session schedule
    let sessions = this.REGULAR_SESSIONS;
    if (market === 'us') {
      sessions = this.US_EQUITY_SESSIONS;
      if (holiday?.type === 'early-close') {
        sessions = [
          sessions[0],
          { name: 'Regular Trading', startTime: { hour: 9, minute: 30 }, endTime: { hour: 13, minute: 0 } },
          { name: 'After-Hours', startTime: { hour: 13, minute: 0 }, endTime: { hour: 17, minute: 0 } }
        ];
      }
    } else if (segment === 'mcx') {
      sessions = [...this.MCX_SESSIONS];
    }

    const specialHolidaySession = holiday ? this.getHolidaySession(holiday) : null;
    const firstSession = specialHolidaySession || sessions[0];

    // 1. If Weekend or Full Holiday today
    if (isWeekend || isHolidayToday) {
      // Check if special session today (e.g. Muhurat)
      if (specialHolidaySession) {
        const startMin = specialHolidaySession.startTime.hour * 60 + specialHolidaySession.startTime.minute;
        const endMin = specialHolidaySession.endTime.hour * 60 + specialHolidaySession.endTime.minute;
        if (curMinuteOfDay >= startMin && curMinuteOfDay < endMin) {
          return {
            isOpen: true,
            isPreMarket: false,
            isMarketOpeningSoon: false,
            isExtendedHours: false,
            currentSession: specialHolidaySession,
            nextSession: null,
            timeUntilNext: 0,
            message: `${specialHolidaySession.name} is now open`,
            isHolidayToday: true,
            holidayInfo: holiday,
            isWeekend
          };
        }
      }

      // Check MCX partial sessions if applicable
      if (segment === 'mcx' && holiday?.mcxStatus) {
        if (holiday.mcxStatus.evening && curMinuteOfDay >= 17 * 60 && curMinuteOfDay < 23 * 60 + 30) {
          const eveningSession = sessions.find(s => s.name === 'Evening Session');
          return {
            isOpen: true,
            isPreMarket: false,
            isMarketOpeningSoon: false,
            isExtendedHours: false,
            currentSession: eveningSession,
            nextSession: null,
            timeUntilNext: 0,
            message: 'MCX Evening Session is now open',
            isHolidayToday: true,
            holidayInfo: holiday,
            isWeekend: false
          };
        }
      }

      // Market is CLOSED today. Calculate exact countdown to the next trading day's first session.
      const nextDateKey = this.getNextTradingDateKey(now, market);
      const nextSessionTargetMs = this.zonedDateTimeToUtcMs(nextDateKey, firstSession.startTime, tz);
      const timeUntilNext = Math.max(0, nextSessionTargetMs - now.getTime());
      const nextDateNoon = this.dateKeyToNoonUtcDate(nextDateKey);
      const nextDayName = nextDateNoon.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });

      let message = '';
      if (isHolidayToday) {
        message = `Market closed for ${holiday.holiday}`;
      } else {
        message = `Market opens on ${nextDayName}`;
      }

      return {
        isOpen: false,
        isPreMarket: false,
        isMarketOpeningSoon: false,
        isExtendedHours: false,
        currentSession: null,
        nextSession: firstSession,
        timeUntilNext,
        message,
        isHolidayToday,
        holidayInfo: holiday,
        isWeekend
      };
    }

    // 2. Normal Trading Day – inspect active session
    for (let i = 0; i < sessions.length; i++) {
      const s = sessions[i];
      const startMin = s.startTime.hour * 60 + s.startTime.minute;
      const endMin = s.endTime.hour * 60 + s.endTime.minute;

      if (curMinuteOfDay >= startMin && curMinuteOfDay < endMin) {
        if (s.name === 'Market Opening Soon') {
          const regularSession = sessions[i + 1] || null;
          const targetMs = this.zonedDateTimeToUtcMs(todayKey, regularSession.startTime, tz);
          return {
            isOpen: false,
            isPreMarket: false,
            isMarketOpeningSoon: true,
            isExtendedHours: false,
            currentSession: s,
            nextSession: regularSession,
            timeUntilNext: Math.max(0, targetMs - now.getTime()),
            message: 'Market opens in',
            isHolidayToday: false,
            holidayInfo: null,
            isWeekend: false
          };
        }

        const isPre = s.name === 'Pre-Market' || s.name.includes('Pre-open');
        const isExt = isPre || s.name === 'After-Hours';
        return {
          isOpen: true,
          isPreMarket: isPre,
          isMarketOpeningSoon: false,
          isExtendedHours: isExt,
          currentSession: s,
          nextSession: null,
          timeUntilNext: 0,
          message: `${s.name} is now open`,
          isHolidayToday: false,
          holidayInfo: null,
          isWeekend: false
        };
      }
    }

    // 3. Before First Session of today
    const firstStartMin = firstSession.startTime.hour * 60 + firstSession.startTime.minute;
    if (curMinuteOfDay < firstStartMin) {
      const targetMs = this.zonedDateTimeToUtcMs(todayKey, firstSession.startTime, tz);
      return {
        isOpen: false,
        isPreMarket: false,
        isMarketOpeningSoon: false,
        isExtendedHours: false,
        currentSession: null,
        nextSession: firstSession,
        timeUntilNext: Math.max(0, targetMs - now.getTime()),
        message: `${firstSession.name} opens in`,
        isHolidayToday: false,
        holidayInfo: null,
        isWeekend: false
      };
    }

    // 4. After Market Close of today – count down to next trading day
    const nextDateKey = this.getNextTradingDateKey(now, market);
    const nextSessionTargetMs = this.zonedDateTimeToUtcMs(nextDateKey, firstSession.startTime, tz);
    const timeUntilNext = Math.max(0, nextSessionTargetMs - now.getTime());
    const tomorrowKey = this.addDaysToDateKey(todayKey, 1);
    const nextDayLabel = nextDateKey === tomorrowKey ? 'tomorrow' : `on ${this.dateKeyToNoonUtcDate(nextDateKey).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' })}`;

    return {
      isOpen: false,
      isPreMarket: false,
      isMarketOpeningSoon: false,
      isExtendedHours: false,
      currentSession: null,
      nextSession: firstSession,
      timeUntilNext,
      message: `Market opens ${nextDayLabel} at`,
      isHolidayToday: false,
      holidayInfo: null,
      isWeekend: false
    };
  }

  /**
   * Generates a high-precision countdown object for TopBar center timer
   */
  static getLiveMarketCountdown(market = 'india') {
    const status = this.getMarketStatus('equity', market);
    const countdownStr = this.formatCountdown(status.timeUntilNext);

    if (status.isHolidayToday && status.holidayInfo) {
      return {
        status: 'HOLIDAY',
        dot: '#f43f5e',
        badgeColor: 'rgba(244, 63, 94, 0.12)',
        textColor: '#e11d48',
        borderColor: 'rgba(244, 63, 94, 0.25)',
        label: `${status.holidayInfo.holiday} • CLOSED`,
        title: status.holidayInfo.holiday,
        subtitle: `Market closed for ${status.holidayInfo.holiday}`,
        extra: null,
        countdown: countdownStr,
        displayText: `Market opens in ${countdownStr}`
      };
    }

    if (status.isWeekend) {
      return {
        status: 'WEEKEND',
        dot: '#94a3b8',
        badgeColor: 'rgba(148, 163, 184, 0.12)',
        textColor: '#64748b',
        borderColor: 'rgba(148, 163, 184, 0.25)',
        label: 'Weekend • CLOSED',
        title: 'Weekend Closure',
        subtitle: 'Markets are closed for the weekend',
        extra: 'Regular trading resumes Monday at 09:15 AM IST',
        countdown: countdownStr,
        displayText: `Market opens in ${countdownStr}`
      };
    }

    if (status.isOpen) {
      if (status.isPreMarket) {
        const now = new Date();
        const tz = market === 'us' ? this.US_TIME_ZONE : this.IST_TIME_ZONE;
        const parts = this.getZonedParts(now, tz);
        const todayKey = this.formatDateKey(parts);
        const openTarget = market === 'us' ? { hour: 9, minute: 30 } : { hour: 9, minute: 15 };
        const openMs = this.zonedDateTimeToUtcMs(todayKey, openTarget, tz);
        const remainingToOpenMs = Math.max(0, openMs - now.getTime());
        const openCountdown = this.formatCountdown(remainingToOpenMs);

        return {
          status: 'PRE_MARKET',
          dot: '#3b82f6',
          badgeColor: 'rgba(59, 130, 246, 0.12)',
          textColor: '#2563eb',
          borderColor: 'rgba(59, 130, 246, 0.25)',
          label: 'Pre-Market • OPEN',
          title: 'Pre-Market Session',
          subtitle: 'Order entry & price discovery (09:00 – 09:08 AM)',
          extra: 'Regular trading starts at 09:15 AM IST',
          countdown: openCountdown,
          displayText: `Pre-Market · Market opens in ${openCountdown}`
        };
      }

      // Calculate time until regular session closes (15:30 IST)
      const now = new Date();
      const tz = market === 'us' ? this.US_TIME_ZONE : this.IST_TIME_ZONE;
      const parts = this.getZonedParts(now, tz);
      const todayKey = this.formatDateKey(parts);
      const closeTarget = market === 'us' ? { hour: 16, minute: 0 } : { hour: 15, minute: 30 };
      const closeMs = this.zonedDateTimeToUtcMs(todayKey, closeTarget, tz);
      const remainingMs = Math.max(0, closeMs - now.getTime());
      const closeCountdown = this.formatCountdown(remainingMs);

      return {
        status: 'LIVE',
        dot: '#10b981',
        badgeColor: '#ecfdf5',
        textColor: '#059669',
        borderColor: '#a7f3d0',
        label: 'Market is LIVE',
        title: market === 'us' ? 'US Regular Trading' : 'Regular Trading Session',
        subtitle: market === 'us' ? 'NYSE & Nasdaq Active (09:30 AM – 04:00 PM ET)' : 'NSE & BSE Active (09:15 AM – 03:30 PM IST)',
        extra: `Market closes in ${closeCountdown}`,
        countdown: closeCountdown,
        displayText: `Market closes in ${closeCountdown}`
      };
    }

    if (status.isMarketOpeningSoon) {
      return {
        status: 'OPENING_SOON',
        dot: '#f59e0b',
        badgeColor: 'rgba(245, 158, 11, 0.12)',
        textColor: '#d97706',
        borderColor: 'rgba(245, 158, 11, 0.25)',
        label: 'Opening Soon',
        title: 'Opening Soon',
        subtitle: 'Pre-open matching complete. Live trading begins shortly',
        extra: `Opens in ${countdownStr}`,
        countdown: countdownStr,
        displayText: `Market opens in ${countdownStr}`
      };
    }

    // Default closed
    return {
      status: 'CLOSED',
      dot: '#f43f5e',
      badgeColor: 'rgba(244, 63, 94, 0.12)',
      textColor: '#e11d48',
      borderColor: 'rgba(244, 63, 94, 0.25)',
      label: 'Market Closed',
      title: 'Market Closed',
      subtitle: 'Post-market & overnight trading session',
      extra: 'Next trading session opens tomorrow at 09:00 AM IST',
      countdown: countdownStr,
      displayText: `Market opens in ${countdownStr}`
    };
  }
}
