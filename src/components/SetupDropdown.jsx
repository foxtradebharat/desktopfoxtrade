import React, { useState, useRef, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { ChevronDown, GripVertical, Check, Trash2, Plus, X } from 'lucide-react';
import { loadPlaybooks } from '../services/playbookService';

const STORAGE_KEY = 'foxtrade_setup_options';

export const DEFAULT_SETUPS = [
  'Chop BO',
  'ITB',
  'IPO Base',
  '3/5/8',
  '21/50',
  'Breakout',
  'Pullback',
  'Reversal',
  'Continuation',
  'Gap Fill',
  'OTB',
  'Stage 2',
  'ONP BO',
  'EP',
  'Pivot Bo',
  'Cheat',
  'Flag',
  'Other'
];

export function getSavedSetups() {
  let baseSetups = DEFAULT_SETUPS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        baseSetups = parsed;
      }
    }
  } catch (e) {
    console.error('Failed to load setups from localStorage:', e);
  }

  // Seamlessly merge setups from Playbook Engine
  try {
    const pbs = loadPlaybooks();
    if (Array.isArray(pbs)) {
      const pbTitles = pbs.map(p => p.title).filter(Boolean);
      const combined = [...baseSetups];
      pbTitles.slice().reverse().forEach(t => {
        const existingIdx = combined.indexOf(t);
        if (existingIdx !== -1) {
          combined.splice(existingIdx, 1);
        }
        combined.unshift(t);
      });
      return combined;
    }
  } catch (e) {
    console.error('Failed to merge playbooks into setups:', e);
  }

  return baseSetups;
}

export function saveSetups(setups) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(setups));
    window.dispatchEvent(new CustomEvent('foxtrade_setups_updated', { detail: setups }));
  } catch (e) {
    console.error('Failed to save setups to localStorage:', e);
  }
}

export default function SetupDropdown({
  value = '',
  onChange,
  placeholder = 'Select setup',
  variant = 'table',
  width = '130px',
  disabled = false,
  style = {}
}) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleCloseOthers = (e) => {
      if (e.detail !== triggerRef.current) {
        setIsOpen(false);
        setIsAddingNew && setIsAddingNew(false);
      }
    };
    window.addEventListener('foxtrade_close_all_popovers', handleCloseOthers);
    return () => window.removeEventListener('foxtrade_close_all_popovers', handleCloseOthers);
  }, []);
  const [setups, setSetups] = useState(() => getSavedSetups());
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0, width: 220, popUpwards: false });
  const [draggedIdx, setDraggedIdx] = useState(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newOptionName, setNewOptionName] = useState('');

  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const addInputRef = useRef(null);

  // Parse current values into an array (supports multi/single)
  const selectedValues = React.useMemo(() => {
    if (!value) return [];
    if (Array.isArray(value)) return value.filter(Boolean);
    if (typeof value === 'string') {
      return value.split(',').map(s => s.trim()).filter(Boolean);
    }
    return [];
  }, [value]);

  useEffect(() => {
    const handleUpdate = (e) => {
      if (e.detail && Array.isArray(e.detail)) {
        setSetups(e.detail);
      }
    };
    window.addEventListener('foxtrade_setups_updated', handleUpdate);
    return () => window.removeEventListener('foxtrade_setups_updated', handleUpdate);
  }, []);

  const updateMenuPosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const estimatedHeight = Math.min(300, setups.length * 36 + 60);
    const popUpwards = spaceBelow < estimatedHeight && rect.top > estimatedHeight;

    setMenuPos({
      top: popUpwards ? rect.top - 4 : rect.bottom + 4,
      left: Math.max(8, Math.min(rect.left, window.innerWidth - 240)),
      width: Math.max(rect.width, 220),
      popUpwards
    });
  }, [setups.length]);

  const toggleOpen = (e) => {
    e.stopPropagation();
    if (disabled) return;
    if (!isOpen) {
      window.dispatchEvent(new CustomEvent('foxtrade_close_all_popovers', { detail: triggerRef.current }));
      updateMenuPosition();
      setIsOpen(true);
    } else {
      setIsOpen(false);
      setIsAddingNew(false);
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
        setIsAddingNew(false);
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

  useEffect(() => {
    if (isAddingNew && addInputRef.current) {
      addInputRef.current.focus();
    }
  }, [isAddingNew]);

  const handleToggleOption = (opt, e) => {
    e.stopPropagation();
    let updated;
    if (selectedValues.includes(opt)) {
      updated = selectedValues.filter(v => v !== opt);
    } else {
      updated = [...selectedValues, opt];
    }
    onChange && onChange(updated.join(', '));
  };

  const handleDeleteOption = (optToDelete, e) => {
    e.stopPropagation();
    const updated = setups.filter(s => s !== optToDelete);
    setSetups(updated);
    saveSetups(updated);
    if (selectedValues.includes(optToDelete)) {
      const newSel = selectedValues.filter(v => v !== optToDelete);
      onChange && onChange(newSel.join(', '));
    }
  };

  const handleDragStart = (idx, e) => {
    e.stopPropagation();
    setDraggedIdx(idx);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (idx, e) => {
    e.preventDefault();
    e.stopPropagation();
    if (draggedIdx === null || draggedIdx === idx) return;
    setDragOverIdx(idx);
  };

  const handleDrop = (idx, e) => {
    e.preventDefault();
    e.stopPropagation();
    if (draggedIdx === null || draggedIdx === idx) return;

    const newSetups = [...setups];
    const [moved] = newSetups.splice(draggedIdx, 1);
    newSetups.splice(idx, 0, moved);

    setSetups(newSetups);
    saveSetups(newSetups);
    setDraggedIdx(null);
    setDragOverIdx(null);
  };

  const handleDragEnd = () => {
    setDraggedIdx(null);
    setDragOverIdx(null);
  };

  const handleAddNewSubmit = (e) => {
    if (e) e.preventDefault();
    const trimmed = newOptionName.trim();
    if (trimmed && !setups.includes(trimmed)) {
      const updated = [...setups, trimmed];
      setSetups(updated);
      saveSetups(updated);
      const newSel = [...selectedValues, trimmed];
      onChange && onChange(newSel.join(', '));
    }
    setNewOptionName('');
    setIsAddingNew(false);
  };

  const renderDisplayLabel = () => {
    if (selectedValues.length === 0) {
      return (
        <span style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {placeholder}
        </span>
      );
    }
    if (selectedValues.length === 1) {
      return (
        <span style={{ color: 'var(--text-primary)', fontSize: '13px', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selectedValues[0]}
        </span>
      );
    }
    return (
      <span style={{ color: 'var(--text-primary)', fontSize: '13px', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {selectedValues[0]} <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>+{selectedValues.length - 1}</span>
      </span>
    );
  };

  return (
    <div style={{ position: 'relative', display: 'inline-block', width, ...style }}>
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
          border: '1px solid var(--border-color)',
          backgroundColor: isOpen ? 'var(--bg-hover)' : 'transparent',
          cursor: disabled ? 'not-allowed' : 'pointer',
          userSelect: 'none',
          gap: '6px',
          transition: 'all 0.15s ease',
          boxSizing: 'border-box'
        }}
        onMouseEnter={(e) => {
          if (!disabled) {
            e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
            e.currentTarget.style.borderColor = 'var(--border-hover)';
          }
        }}
        onMouseLeave={(e) => {
          if (!disabled && !isOpen) {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.borderColor = 'var(--border-color)';
          }
        }}
      >
        <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center' }}>
          {renderDisplayLabel()}
        </div>
        <ChevronDown
          size={13}
          style={{
            color: 'var(--text-muted)',
            flexShrink: 0,
            transform: isOpen ? 'rotate(180deg)' : 'none',
            transition: 'transform 0.15s ease'
          }}
        />
      </div>

      {isOpen && ReactDOM.createPortal(
        <div
          ref={menuRef}
          style={{
            position: 'fixed',
            top: `${menuPos.top}px`,
            left: `${menuPos.left}px`,
            width: `${menuPos.width}px`,
            transform: menuPos.popUpwards ? 'translateY(-100%)' : 'none',
            maxHeight: '280px',
            backgroundColor: 'var(--bg-surface)',
            borderRadius: '10px',
            border: '1px solid var(--border-color)',
            boxShadow: '0 16px 40px -4px rgba(0, 0, 0, 0.3), 0 4px 12px -2px rgba(0, 0, 0, 0.12)',
            padding: '4px',
            zIndex: 999999,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxSizing: 'border-box',
            animation: 'foxtradeFadeZoom 0.15s ease'
          }}
        >
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              maxHeight: '220px',
              display: 'flex',
              flexDirection: 'column',
              gap: '1px',
              paddingRight: '2px'
            }}
          >
            {setups.map((opt, idx) => {
              const isSelected = selectedValues.includes(opt);
              const isBeingDragged = draggedIdx === idx;
              const isDragOver = dragOverIdx === idx;

              return (
                <div
                  key={opt}
                  draggable
                  onDragStart={(e) => handleDragStart(idx, e)}
                  onDragOver={(e) => handleDragOver(idx, e)}
                  onDrop={(e) => handleDrop(idx, e)}
                  onDragEnd={handleDragEnd}
                  onClick={(e) => handleToggleOption(opt, e)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '5px 8px',
                    borderRadius: '6px',
                    backgroundColor: isDragOver
                      ? 'var(--bg-hover)'
                      : isSelected
                      ? 'color-mix(in srgb, var(--accent-orange, #f97316) 12%, transparent)'
                      : 'transparent',
                    opacity: isBeingDragged ? 0.4 : 1,
                    cursor: 'pointer',
                    fontSize: '12.5px',
                    color: 'var(--text-primary)',
                    transition: 'background-color 0.1s ease',
                    userSelect: 'none'
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected && !isDragOver) {
                      e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected && !isDragOver) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                    <div
                      title="Drag to reorder"
                      style={{ cursor: 'grab', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', flexShrink: 0 }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <GripVertical size={13} />
                    </div>

                    {/* Black Consistent Checkbox */}
                    <div
                      style={{
                        width: '15px',
                        height: '15px',
                        borderRadius: '4px',
                        border: isSelected ? '1.5px solid var(--text-primary)' : '1.5px solid var(--border-color)',
                        backgroundColor: isSelected ? 'var(--text-primary)' : 'var(--bg-surface)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        transition: 'all 0.12s ease'
                      }}
                    >
                      {isSelected && <Check size={11} strokeWidth={3} color="var(--bg-surface)" />}
                    </div>

                    <span
                      style={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        fontWeight: isSelected ? 600 : 400
                      }}
                    >
                      {opt}
                    </span>
                  </div>

                  <button
                    type="button"
                    title="Delete option"
                    onClick={(e) => handleDeleteOption(opt, e)}
                    style={{
                      border: 'none',
                      background: 'none',
                      color: 'var(--text-muted)',
                      padding: '2px',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      opacity: 0.6,
                      transition: 'all 0.12s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = 'var(--color-red, #ef4444)';
                      e.currentTarget.style.opacity = '1';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = 'var(--text-muted)';
                      e.currentTarget.style.opacity = '0.6';
                    }}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              );
            })}
          </div>

          <div style={{ height: '1px', backgroundColor: 'var(--border-color)', margin: '4px 0' }} />

          {/* Inline Add Form */}
          {isAddingNew ? (
            <form onSubmit={handleAddNewSubmit} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '2px 4px' }}>
              <input
                ref={addInputRef}
                type="text"
                value={newOptionName}
                onChange={(e) => setNewOptionName(e.target.value)}
                placeholder="Enter setup name..."
                style={{
                  flex: 1,
                  height: '26px',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-surface)',
                  color: 'var(--text-primary)',
                  fontSize: '12px',
                  outline: 'none'
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setIsAddingNew(false);
                }}
              />
              <button
                type="submit"
                style={{
                  height: '26px',
                  padding: '0 8px',
                  borderRadius: '4px',
                  backgroundColor: 'var(--text-primary)',
                  color: 'var(--bg-surface)',
                  border: 'none',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Add
              </button>
              <button
                type="button"
                onClick={() => setIsAddingNew(false)}
                style={{
                  height: '26px',
                  padding: '0 4px',
                  borderRadius: '4px',
                  backgroundColor: 'transparent',
                  color: 'var(--text-muted)',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                <X size={13} />
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsAddingNew(true);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                width: '100%',
                padding: '6px 8px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: 'transparent',
                color: 'var(--text-primary)',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'background-color 0.1s ease'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <Plus size={13} strokeWidth={2.5} />
              <span>Add new setup...</span>
            </button>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}
