import React, { useState, useRef, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { ChevronDown } from 'lucide-react';

/**
 * ModernDropdown - Institutional-grade, sleek floating dropdown menu
 * Replaces standard HTML <select> elements across TradeOnTip.
 *
 * @param {Object} props
 * @param {string|number} props.value - Currently selected value
 * @param {function} props.onChange - Callback with new value
 * @param {Array<Object|string>} props.options - List of options [{value, label}] or ['Opt1', 'Opt2']
 * @param {string} [props.placeholder='Select...'] - Placeholder when no value is selected
 * @param {string} [props.prefix=''] - Optional prefix label before value (e.g., 'Status: ')
 * @param {'table'|'form'|'inline'|'pill'} [props.variant='table'] - Visual style preset
 * @param {boolean} [props.usePortal=true] - Render menu via ReactDOM.createPortal to avoid overflow clipping
 * @param {'left'|'right'} [props.align='left'] - Menu alignment relative to trigger
 * @param {boolean} [props.disabled=false] - Disable interaction
 * @param {string} [props.width] - Custom width for trigger (e.g. '120px', '100%')
 * @param {string} [props.minMenuWidth] - Custom min-width for dropdown menu
 * @param {Object} [props.style] - Custom trigger style overrides
 * @param {Object} [props.menuStyle] - Custom floating menu style overrides
 */
export default function ModernDropdown({
  value,
  onChange,
  options = [],
  placeholder = 'Select...',
  prefix = '',
  variant = 'table',
  usePortal = true,
  align = 'left',
  disabled = false,
  width,
  minMenuWidth,
  style = {},
  menuStyle = {}
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0, width: 0, popUpwards: false });
  const triggerRef = useRef(null);
  const menuRef = useRef(null);

  // Normalize options array: [{ value, label }]
  const normalizedOptions = options.map(opt => {
    if (typeof opt === 'object' && opt !== null) {
      return { value: opt.value, label: opt.label !== undefined ? opt.label : String(opt.value) };
    }
    return { value: opt, label: String(opt) };
  });

  // Find currently selected option label
  const selectedOption = normalizedOptions.find(opt => String(opt.value) === String(value));
  const displayLabel = selectedOption ? selectedOption.label : (value || placeholder);
  const isPlaceholder = !selectedOption && !value;

  // Calculate portal popup coordinates
  const updateMenuPosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const popUpwards = spaceBelow < 190 && rect.top > 190;

    let left = rect.left + window.scrollX;
    if (align === 'right') {
      left = rect.right + window.scrollX;
    }

    setMenuPos({
      top: popUpwards ? (rect.top + window.scrollY - 6) : (rect.bottom + window.scrollY + 6),
      left,
      width: Math.max(rect.width, 140),
      popUpwards
    });
  }, [align]);

  // Handle opening and positioning
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

  // Keyboard accessibility
  const handleKeyDown = (e) => {
    if (disabled) return;
    if (e.key === 'Escape') {
      setIsOpen(false);
    } else if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      if (!isOpen) {
        e.preventDefault();
        updateMenuPosition();
        setIsOpen(true);
      }
    }
  };

  // Preset styles based on variant
  const getTriggerStyles = () => {
    const base = {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '6px',
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.6 : 1,
      userSelect: 'none',
      transition: 'all 0.15s ease',
      fontFamily: 'inherit',
      outline: 'none',
      width: width || (variant === 'form' ? '100%' : 'auto'),
      boxSizing: 'border-box'
    };

    if (variant === 'table') {
      return {
        ...base,
        padding: '5px 10px',
        borderRadius: '8px',
        border: '1px solid var(--border-color, #e5e7eb)',
        backgroundColor: 'var(--bg-card, #ffffff)',
        fontSize: '12px',
        fontWeight: isPlaceholder ? 400 : 600,
        color: isPlaceholder ? 'var(--text-muted, #9ca3af)' : 'var(--text-primary, #111827)',
        boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
        minWidth: width || '120px'
      };
    }

    if (variant === 'form') {
      return {
        ...base,
        padding: '8px 12px',
        borderRadius: '8px',
        border: '1px solid var(--border-color, #e5e7eb)',
        backgroundColor: 'var(--bg-card, #ffffff)',
        fontSize: '13px',
        fontWeight: 500,
        color: isPlaceholder ? 'var(--text-muted, #9ca3af)' : 'var(--text-primary, #111827)',
        boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
      };
    }

    if (variant === 'inline') {
      return {
        ...base,
        padding: '4px 8px',
        borderRadius: '8px',
        border: 'none',
        backgroundColor: 'transparent',
        fontSize: '13px',
        fontWeight: 600,
        color: 'var(--text-primary, #111827)'
      };
    }

    if (variant === 'pill') {
      return {
        ...base,
        padding: '4px 10px',
        borderRadius: '9999px',
        border: '1px solid var(--border-color, #e5e7eb)',
        backgroundColor: 'var(--bg-card, #ffffff)',
        fontSize: '12px',
        fontWeight: 600,
        color: 'var(--text-primary, #111827)'
      };
    }

    return base;
  };

  // Dropdown Menu Popover element
  const menuElement = isOpen && (
    <div
      ref={menuRef}
      data-modern-dropdown-menu
      style={{
        position: 'absolute',
        top: usePortal ? (menuPos.popUpwards ? 'auto' : `${menuPos.top}px`) : (menuPos.popUpwards ? 'auto' : 'calc(100% + 6px)'),
        bottom: usePortal && menuPos.popUpwards ? `${window.innerHeight - menuPos.top}px` : (menuPos.popUpwards ? 'calc(100% + 6px)' : 'auto'),
        left: usePortal ? (align === 'right' ? 'auto' : `${menuPos.left}px`) : (align === 'right' ? 'auto' : 0),
        right: usePortal ? (align === 'right' ? `${window.innerWidth - menuPos.left}px` : 'auto') : (align === 'right' ? 0 : 'auto'),
        zIndex: 99999,
        backgroundColor: 'var(--bg-card, #ffffff)',
        borderRadius: '16px',
        padding: '6px',
        minWidth: minMenuWidth || `${Math.max(menuPos.width, 150)}px`,
        maxWidth: '320px',
        border: '1px solid var(--border-color, rgba(0, 0, 0, 0.08))',
        boxShadow: '0 12px 30px -4px rgba(0, 0, 0, 0.12), 0 8px 10px -6px rgba(0, 0, 0, 0.04)',
        display: 'flex',
        flexDirection: 'column',
        gap: '2px',
        maxHeight: '260px',
        overflowY: 'auto',
        animation: 'modernDropdownFadeIn 0.14s ease-out',
        ...menuStyle
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {normalizedOptions.map((opt) => {
        const isSelected = String(opt.value) === String(value);
        return (
          <div
            key={String(opt.value)}
            onClick={(e) => {
              e.stopPropagation();
              onChange(opt.value);
              setIsOpen(false);
            }}
            style={{
              padding: '7px 12px',
              borderRadius: '10px',
              fontSize: '12.5px',
              fontWeight: isSelected ? 600 : 500,
              color: isSelected ? 'var(--text-primary, #111827)' : 'var(--text-secondary, #374151)',
              backgroundColor: isSelected ? 'rgba(0, 0, 0, 0.05)' : 'transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '8px',
              transition: 'background-color 0.12s ease'
            }}
            onMouseEnter={(e) => {
              if (!isSelected) e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.035)';
            }}
            onMouseLeave={(e) => {
              if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {opt.label}
            </span>
            {isSelected && (
              <span
                style={{
                  width: '5px',
                  height: '5px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--text-primary, #111827)',
                  flexShrink: 0
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );

  return (
    <div style={{ position: 'relative', display: 'inline-block', width: width || (variant === 'form' ? '100%' : 'auto') }}>
      <button
        ref={triggerRef}
        type="button"
        onClick={handleToggle}
        onKeyDown={handleKeyDown}
        style={{
          ...getTriggerStyles(),
          ...style
        }}
        onMouseEnter={(e) => {
          if (!disabled) {
            if (variant === 'inline') e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.04)';
            else e.currentTarget.style.borderColor = 'var(--border-hover, #d0d5dd)';
          }
        }}
        onMouseLeave={(e) => {
          if (!disabled) {
            if (variant === 'inline') {
              if (!isOpen) e.currentTarget.style.backgroundColor = 'transparent';
            } else {
              e.currentTarget.style.borderColor = isOpen ? 'var(--border-hover, #9ca3af)' : 'var(--border-color, #e5e7eb)';
            }
          }
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {prefix && <span style={{ color: 'var(--text-secondary, #6b7280)', fontWeight: 500 }}>{prefix}</span>}
          <span>{displayLabel}</span>
        </span>
        <ChevronDown
          size={variant === 'inline' ? 14 : 13}
          color="var(--text-muted, #6b7280)"
          style={{
            transition: 'transform 0.2s ease',
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            flexShrink: 0,
            marginLeft: '4px'
          }}
        />
      </button>

      {usePortal
        ? typeof document !== 'undefined' && ReactDOM.createPortal(menuElement, document.body)
        : menuElement}
    </div>
  );
}
