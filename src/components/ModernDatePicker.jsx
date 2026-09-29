import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X } from 'lucide-react';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const WEEKDAY_NAMES = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

// Helper to parse multiple date formats safely
function parseDateString(str) {
  if (!str) return null;
  if (typeof str !== 'string') return null;

  // Handle YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    const [year, month, day] = str.split('T')[0].split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  // Handle DD-MM-YYYY or DD/MM/YYYY
  if (/^\d{2}[-/]\d{2}[-/]\d{4}/.test(str)) {
    const parts = str.split(/[-/]/).map(Number);
    return new Date(parts[2], parts[1] - 1, parts[0]);
  }

  const parsed = new Date(str);
  return isNaN(parsed.getTime()) ? null : parsed;
}

// Helper to format Date to YYYY-MM-DD
function formatDateToISO(date) {
  if (!date) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Helper to format Date for display
function formatDateDisplay(str) {
  if (!str) return null;
  const d = parseDateString(str);
  if (!d) return str;
  const day = String(d.getDate()).padStart(2, '0');
  const month = d.toLocaleString('en-US', { month: 'short' });
  const year = d.getFullYear();
  return `${day} ${month} ${year}`;
}

export default function ModernDatePicker({
  value,
  onChange,
  placeholder = 'Select date',
  width = '130px',
  disabled = false,
  variant = 'table', // 'table' | 'form'
  usePortal = true
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0, popUpwards: false });
  const triggerRef = useRef(null);
  const menuRef = useRef(null);

  const selectedDate = useMemo(() => parseDateString(value), [value]);

  // Current viewing month & year in calendar
  const [viewDate, setViewDate] = useState(() => {
    return selectedDate || new Date();
  });

  // Sync viewDate when value changes externally
  useEffect(() => {
    if (selectedDate) {
      setViewDate(selectedDate);
    }
  }, [selectedDate]);

  // Calculate coordinates for portal rendering
  const updateMenuPosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const popUpwards = spaceBelow < 280 && rect.top > 280;

    let left = rect.left + window.scrollX;
    // Keep within right edge
    if (left + 260 > window.innerWidth) {
      left = window.innerWidth - 270 + window.scrollX;
    }

    setMenuPos({
      top: popUpwards 
        ? (rect.top + window.scrollY - 6) 
        : (rect.bottom + window.scrollY + 6),
      left,
      popUpwards
    });
  }, []);

  const handleToggle = (e) => {
    e.stopPropagation();
    if (disabled) return;
    if (!isOpen) {
      updateMenuPosition();
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  };

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;

    const handleOutsideClick = (e) => {
      if (
        triggerRef.current &&
        !triggerRef.current.contains(e.target) &&
        menuRef.current &&
        !menuRef.current.contains(e.target)
      ) {
        setIsOpen(false);
      }
    };

    const handleScrollOrResize = () => {
      if (isOpen) updateMenuPosition();
    };

    document.addEventListener('mousedown', handleOutsideClick);
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [isOpen, updateMenuPosition]);

  const viewYear = viewDate.getFullYear();
  const viewMonth = viewDate.getMonth();

  const handlePrevMonth = (e) => {
    e.stopPropagation();
    setViewDate(new Date(viewYear, viewMonth - 1, 1));
  };

  const handleNextMonth = (e) => {
    e.stopPropagation();
    setViewDate(new Date(viewYear, viewMonth + 1, 1));
  };

  const handleSelectDay = (day) => {
    const newDate = new Date(viewYear, viewMonth, day);
    const isoString = formatDateToISO(newDate);
    if (onChange) onChange(isoString);
    setIsOpen(false);
  };

  const handleTodayClick = (e) => {
    e.stopPropagation();
    const today = new Date();
    const isoString = formatDateToISO(today);
    if (onChange) onChange(isoString);
    setViewDate(today);
    setIsOpen(false);
  };

  const handleClearClick = (e) => {
    e.stopPropagation();
    if (onChange) onChange('');
    setIsOpen(false);
  };

  // Compute days for the month grid
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay(); // 0 = Sunday
  const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

  const isToday = (day) => {
    const today = new Date();
    return (
      today.getFullYear() === viewYear &&
      today.getMonth() === viewMonth &&
      today.getDate() === day
    );
  };

  const isSelected = (day) => {
    if (!selectedDate) return false;
    return (
      selectedDate.getFullYear() === viewYear &&
      selectedDate.getMonth() === viewMonth &&
      selectedDate.getDate() === day
    );
  };

  const displayLabel = selectedDate ? formatDateDisplay(value) : placeholder;

  const calendarMenu = (
    <div
      ref={menuRef}
      style={{
        position: 'absolute',
        top: menuPos.top,
        left: menuPos.left,
        transform: menuPos.popUpwards ? 'translateY(-100%)' : 'none',
        zIndex: 99999,
        width: '252px',
        backgroundColor: 'var(--bg-card, #ffffff)',
        borderRadius: '16px',
        border: '1px solid var(--border-color, rgba(0, 0, 0, 0.12))',
        boxShadow: '0 16px 40px -8px rgba(0, 0, 0, 0.22), 0 4px 12px rgba(0, 0, 0, 0.05)',
        padding: '12px',
        animation: 'modernDropdownFadeIn 0.15s ease-out',
        color: 'var(--text-primary, #111827)',
        userSelect: 'none'
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header (Month & Year navigation) */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '10px'
      }}>
        <button
          type="button"
          onClick={handlePrevMonth}
          title="Previous month"
          style={{
            width: '26px',
            height: '26px',
            borderRadius: '6px',
            border: '1px solid var(--border-color, #e5e7eb)',
            backgroundColor: 'transparent',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: 'var(--text-secondary, #4b5563)',
            transition: 'background-color 0.1s ease'
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.04)'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
        >
          <ChevronLeft size={14} />
        </button>

        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary, #111827)' }}>
          {MONTH_NAMES[viewMonth]} {viewYear}
        </span>

        <button
          type="button"
          onClick={handleNextMonth}
          title="Next month"
          style={{
            width: '26px',
            height: '26px',
            borderRadius: '6px',
            border: '1px solid var(--border-color, #e5e7eb)',
            backgroundColor: 'transparent',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: 'var(--text-secondary, #4b5563)',
            transition: 'background-color 0.1s ease'
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.04)'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
        >
          <ChevronRight size={14} />
        </button>
      </div>

      {/* Weekdays Row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(7, 1fr)',
        textAlign: 'center',
        marginBottom: '6px'
      }}>
        {WEEKDAY_NAMES.map((wd) => (
          <span key={wd} style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted, #9ca3af)' }}>
            {wd}
          </span>
        ))}
      </div>

      {/* Day Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(7, 1fr)',
        gap: '2px'
      }}>
        {/* Days from previous month */}
        {Array.from({ length: firstDayOfWeek }).map((_, i) => {
          const prevMonthDay = daysInPrevMonth - firstDayOfWeek + i + 1;
          return (
            <div
              key={`prev-${i}`}
              style={{
                height: '28px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '11.5px',
                color: 'var(--text-muted, #9ca3af)',
                opacity: 0.5,
                pointerEvents: 'none'
              }}
            >
              {prevMonthDay}
            </div>
          );
        })}

        {/* Days of current month */}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const selected = isSelected(day);
          const today = isToday(day);

          return (
            <button
              key={`day-${day}`}
              type="button"
              onClick={() => handleSelectDay(day)}
              style={{
                height: '28px',
                borderRadius: '7px',
                border: today && !selected ? '1px solid var(--text-primary, #111827)' : 'none',
                backgroundColor: selected ? 'var(--text-primary, #111827)' : 'transparent',
                color: selected ? 'var(--bg-card, #ffffff)' : today ? 'var(--text-primary, #111827)' : 'var(--text-primary, #111827)',
                fontSize: '12px',
                fontWeight: selected || today ? 600 : 400,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.1s ease',
                position: 'relative'
              }}
              onMouseEnter={(e) => {
                if (!selected) e.currentTarget.style.backgroundColor = 'var(--bg-hover, rgba(0,0,0,0.05))';
              }}
              onMouseLeave={(e) => {
                if (!selected) e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              {day}
            </button>
          );
        })}
      </div>

      {/* Bottom Action Footer (Today / Clear) */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: '10px',
        paddingTop: '8px',
        borderTop: '1px solid var(--border-color, rgba(0,0,0,0.08))'
      }}>
        <button
          type="button"
          onClick={handleClearClick}
          style={{
            background: 'none',
            border: 'none',
            padding: '3px 6px',
            fontSize: '11px',
            fontWeight: 600,
            color: 'var(--text-muted, #9ca3af)',
            cursor: 'pointer',
            borderRadius: '4px'
          }}
          onMouseEnter={(e) => e.currentTarget.style.color = '#ef4444'}
          onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted, #9ca3af)'}
        >
          Clear
        </button>

        <button
          type="button"
          onClick={handleTodayClick}
          style={{
            background: 'none',
            border: 'none',
            padding: '3px 8px',
            fontSize: '11px',
            fontWeight: 600,
            color: '#2563eb',
            cursor: 'pointer',
            borderRadius: '4px'
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(37, 99, 235, 0.1)'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
        >
          Today
        </button>
      </div>
    </div>
  );

  return (
    <div
      style={{
        position: 'relative',
        display: 'inline-block',
        width: width,
        boxSizing: 'border-box'
      }}
    >
      {/* Trigger Button */}
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={handleToggle}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '6px',
          width: '100%',
          boxSizing: 'border-box',
          padding: variant === 'form' ? '8px 12px' : '5px 10px',
          borderRadius: '8px',
          border: isOpen ? '1px solid #111827' : '1px solid var(--border-color, #e5e7eb)',
          backgroundColor: 'var(--bg-card, #ffffff)',
          fontSize: '12px',
          fontWeight: 500,
          color: selectedDate ? 'var(--text-primary, #111827)' : 'var(--text-muted, #9ca3af)',
          boxShadow: isOpen ? '0 0 0 2px rgba(0, 0, 0, 0.05)' : '0 1px 2px rgba(0, 0, 0, 0.02)',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.6 : 1,
          userSelect: 'none',
          transition: 'all 0.15s ease',
          outline: 'none',
          minWidth: width
        }}
        onMouseEnter={(e) => {
          if (!disabled && !isOpen) e.currentTarget.style.borderColor = 'var(--border-hover, #cbd5e1)';
        }}
        onMouseLeave={(e) => {
          if (!disabled && !isOpen) e.currentTarget.style.borderColor = 'var(--border-color, #e5e7eb)';
        }}
      >
        <span style={{
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}>
          {displayLabel}
        </span>
        <CalendarIcon
          size={13}
          color="var(--text-muted, #6b7280)"
          style={{ flexShrink: 0, marginLeft: '4px' }}
        />
      </button>

      {/* Render via Portal or Inline */}
      {isOpen && (usePortal ? ReactDOM.createPortal(calendarMenu, document.body) : calendarMenu)}
    </div>
  );
}
