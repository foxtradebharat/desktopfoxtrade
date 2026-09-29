import React, { useState, useRef, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { ChevronDown, Check } from 'lucide-react';
import BrokerLogo from './BrokerLogo';
import { BROKER_DEFINITIONS } from '../services/brokerLogos';

export const BROKER_OPTIONS = BROKER_DEFINITIONS;

export default function BrokerDropdown({
  value = 'not_defined',
  onChange,
  width = '125px',
  disabled = false,
  style = {}
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0, width: 210, popUpwards: false });

  const triggerRef = useRef(null);
  const menuRef = useRef(null);

  const activeBrokerId = (value || 'not_defined').toLowerCase();
  const currentBroker = BROKER_OPTIONS.find(b => b.id === activeBrokerId) || BROKER_OPTIONS[0];

  useEffect(() => {
    const handleCloseOthers = (e) => {
      if (e.detail !== triggerRef.current) {
        setIsOpen(false);
      }
    };
    window.addEventListener('foxtrade_close_all_popovers', handleCloseOthers);
    return () => window.removeEventListener('foxtrade_close_all_popovers', handleCloseOthers);
  }, []);

  const updateMenuPosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const estimatedHeight = 260;
    const popUpwards = spaceBelow < estimatedHeight && rect.top > estimatedHeight;

    setMenuPos({
      top: popUpwards ? rect.top - 4 : rect.bottom + 4,
      left: Math.max(8, Math.min(rect.left, window.innerWidth - 230)),
      width: Math.max(rect.width, 210),
      popUpwards
    });
  }, []);

  const toggleOpen = (e) => {
    e.stopPropagation();
    if (disabled) return;
    if (!isOpen) {
      window.dispatchEvent(new CustomEvent('foxtrade_close_all_popovers', { detail: triggerRef.current }));
      updateMenuPosition();
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    const handleOutsideClick = (e) => {
      if (
        triggerRef.current && !triggerRef.current.contains(e.target) &&
        menuRef.current && !menuRef.current.contains(e.target)
      ) {
        setIsOpen(false);
      }
    };

    const handleScrollOrResize = () => {
      updateMenuPosition();
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

  const handleSelect = (brokerId, e) => {
    e.stopPropagation();
    onChange?.(brokerId);
    setIsOpen(false);
  };

  return (
    <div style={{ position: 'relative', display: 'inline-block', width, ...style }}>
      {/* Trigger button */}
      <div
        ref={triggerRef}
        onClick={toggleOpen}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: '28px',
          padding: '2px 8px',
          borderRadius: '6px',
          border: currentBroker.id !== 'not_defined'
            ? `1px solid ${currentBroker.color}40`
            : '1px solid var(--border-color)',
          backgroundColor: isOpen
            ? 'var(--bg-hover)'
            : currentBroker.id !== 'not_defined'
            ? currentBroker.bg
            : 'transparent',
          cursor: disabled ? 'not-allowed' : 'pointer',
          userSelect: 'none',
          gap: '6px',
          transition: 'all 0.15s ease',
          boxSizing: 'border-box'
        }}
        onMouseEnter={(e) => {
          if (!disabled) {
            e.currentTarget.style.backgroundColor = currentBroker.id !== 'not_defined' ? currentBroker.bg : 'var(--bg-hover)';
            e.currentTarget.style.borderColor = currentBroker.id !== 'not_defined' ? currentBroker.color : 'var(--border-hover)';
          }
        }}
        onMouseLeave={(e) => {
          if (!disabled && !isOpen) {
            e.currentTarget.style.backgroundColor = currentBroker.id !== 'not_defined' ? currentBroker.bg : 'transparent';
            e.currentTarget.style.borderColor = currentBroker.id !== 'not_defined' ? `${currentBroker.color}40` : 'var(--border-color)';
          }
        }}
      >
        <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
          <BrokerLogo broker={currentBroker.id} size={15} />
          <span
            style={{
              fontSize: '12px',
              fontWeight: currentBroker.id !== 'not_defined' ? 600 : 400,
              color: currentBroker.id !== 'not_defined' ? 'var(--text-primary)' : 'var(--text-muted)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}
          >
            {currentBroker.label}
          </span>
        </div>

        <ChevronDown
          size={12}
          style={{
            color: currentBroker.id !== 'not_defined' ? currentBroker.color : 'var(--text-muted)',
            flexShrink: 0,
            transform: isOpen ? 'rotate(180deg)' : 'none',
            transition: 'transform 0.15s ease'
          }}
        />
      </div>

      {/* Popover Menu via Portal */}
      {isOpen &&
        ReactDOM.createPortal(
          <div
            ref={menuRef}
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'fixed',
              top: menuPos.popUpwards ? 'auto' : `${menuPos.top}px`,
              bottom: menuPos.popUpwards ? `${window.innerHeight - menuPos.top}px` : 'auto',
              left: `${menuPos.left}px`,
              width: `${menuPos.width}px`,
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-color)',
              borderRadius: '10px',
              boxShadow: '0 12px 28px -4px rgba(0, 0, 0, 0.3), 0 4px 8px -2px rgba(0, 0, 0, 0.12)',
              zIndex: 99999,
              padding: '6px',
              display: 'flex',
              flexDirection: 'column',
              gap: '2px',
              boxSizing: 'border-box'
            }}
          >
            <div
              style={{
                fontSize: '10.5px',
                fontWeight: 700,
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                padding: '4px 8px 6px'
              }}
            >
              Select Broker
            </div>

            <div style={{ maxHeight: '220px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {BROKER_OPTIONS.map((broker) => {
                const isSelected = broker.id === activeBrokerId;
                return (
                  <div
                    key={broker.id}
                    onClick={(e) => handleSelect(broker.id, e)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '7px 8px',
                      borderRadius: '6px',
                      backgroundColor: isSelected ? 'var(--bg-hover)' : 'transparent',
                      cursor: 'pointer',
                      fontSize: '12.5px',
                      color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
                      fontWeight: isSelected ? 700 : 500,
                      transition: 'background-color 0.1s ease',
                      userSelect: 'none'
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <BrokerLogo broker={broker.id} size={16} />
                      <span>{broker.label}</span>
                    </div>

                    {isSelected && (
                      <Check
                        size={14}
                        strokeWidth={2.5}
                        color="var(--text-primary)"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
