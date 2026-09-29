import React, { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown, Columns, Eye, EyeOff, Image, Plus, Upload, Download, Cloud, BarChart2, Briefcase, LayoutGrid, Zap, Radio } from 'lucide-react';
import ColumnsPopover from './ColumnsPopover';
import ExportDropdown from './ExportDropdown';
import PnlIcon from './PnlIcon';
import NewsIcon from './NewsIcon';

const STATUS_OPTIONS = [
  { value: 'All', label: 'All' },
  { value: 'Active', label: 'Active (Open + Partial)' },
  { value: 'Open', label: 'Open' },
  { value: 'Partial', label: 'Partial' },
  { value: 'Closed', label: 'Closed' }
];

export default function Toolbar({ 
  searchTerm, 
  setSearchTerm, 
  statusFilter, 
  setStatusFilter,
  hideValues,
  setHideValues,
  journalViewMode = 'stats',
  setJournalViewMode,
  onAddTradeClick,
  onQuickLogClick,
  onElectricityBillClick,
  onImportClick,
  onExportClick,
  onGoogleDriveSyncClick,
  onColumnsClick,
  onViewChartClick,
  onBrowseImagesClick,
  visibleCols,
  onToggleCol,
  onSelectAllCols,
  onDeselectAllCols,
  columnOrder,
  onReorderCols,
  settings,
  onUpdateSetting,
  trades = [],
  portfolios = [],
  capitalChanges = {},
  sortBy = 'pl',
  setSortBy
}) {
  const [showSearchInput, setShowSearchInput] = useState(false);
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);
  const [isColumnsPopoverOpen, setIsColumnsPopoverOpen] = useState(false);
  const statusDropdownRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(event.target)) {
        setIsStatusDropdownOpen(false);
      }
    }
    if (isStatusDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isStatusDropdownOpen]);

  const currentStatusLabel = STATUS_OPTIONS.find(opt => opt.value === statusFilter)?.label || statusFilter || 'All';
  const triggerDisplayLabel = statusFilter === 'Active' ? 'Active' : currentStatusLabel;

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '16px 24px 8px 24px',
      backgroundColor: 'var(--bg-primary)',
      gap: '12px',
      position: 'relative'
    }}>
      {/* Column 1: Left side controls */}
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        minWidth: 0
      }}>
        {journalViewMode !== 'grid' && journalViewMode !== 'news' && (
          <>
            {/* Toggleable Expandable Search Input matching Nexus */}
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <button 
            onClick={() => setShowSearchInput(!showSearchInput)}
            title="Search trades" 
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-surface)',
              cursor: 'pointer',
              boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
              transition: 'all 0.2s ease',
              zIndex: 2
            }}
          >
            <Search size={13} color="var(--text-muted)" />
          </button>
          
          {showSearchInput && (
            <input 
              type="text" 
              placeholder="Search symbols, setups..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                height: '32px',
                padding: '0 12px 0 36px',
                marginLeft: '-32px',
                borderRadius: '9999px',
                border: '1px solid var(--border-color)',
                fontSize: '12px',
                outline: 'none',
                width: '210px',
                backgroundColor: 'var(--bg-surface)',
                color: 'var(--text-primary)',
                boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
                transition: 'all 0.25s ease'
              }}
              autoFocus
            />
          )}
        </div>

        {/* Status Custom Modern Dropdown (Hidden in Portfolio mode matching Nexus) */}
        {journalViewMode !== 'portfolio' && (
          <div ref={statusDropdownRef} style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => setIsStatusDropdownOpen(!isStatusDropdownOpen)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  background: 'none',
                  border: 'none',
                  padding: '4px 8px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: 'var(--text-primary, #111827)',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.04)'}
                onMouseLeave={(e) => {
                  if (!isStatusDropdownOpen) e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <span style={{ color: 'var(--text-secondary, #374151)', fontWeight: 500 }}>Status:</span>
                <span>{triggerDisplayLabel}</span>
                <ChevronDown 
                  size={14} 
                  color="var(--text-secondary, #6b7280)" 
                  style={{ 
                    transition: 'transform 0.2s ease', 
                    transform: isStatusDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)' 
                  }} 
                />
              </button>

              {/* Floating Modern Popover Menu */}
              {isStatusDropdownOpen && (
                <div style={{
                  position: 'absolute',
                  top: 'calc(100% + 6px)',
                  left: 0,
                  zIndex: 60,
                  backgroundColor: 'var(--bg-card, #ffffff)',
                  borderRadius: '16px',
                  padding: '8px 6px',
                  minWidth: '190px',
                  border: '1px solid var(--border-color, rgba(0, 0, 0, 0.06))',
                  boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.04)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '2px'
                }}>
                  {STATUS_OPTIONS.map(opt => {
                    const isSelected = (statusFilter === opt.value) || (!statusFilter && opt.value === 'All');
                    return (
                      <div
                        key={opt.value}
                        onClick={() => {
                          setStatusFilter(opt.value);
                          setIsStatusDropdownOpen(false);
                        }}
                        style={{
                          padding: '8px 12px',
                          borderRadius: '10px',
                          fontSize: '13px',
                          fontWeight: isSelected ? 600 : 400,
                          color: isSelected ? 'var(--text-primary, #111827)' : 'var(--text-secondary, #374151)',
                          backgroundColor: isSelected ? 'rgba(0, 0, 0, 0.04)' : 'transparent',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          transition: 'background-color 0.12s ease'
                        }}
                        onMouseEnter={(e) => {
                          if (!isSelected) e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.03)';
                        }}
                        onMouseLeave={(e) => {
                          if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                      >
                        <span>{opt.label}</span>
                        {isSelected && (
                          <span style={{
                            width: '5px',
                            height: '5px',
                            borderRadius: '50%',
                            backgroundColor: 'var(--text-primary, #111827)'
                          }} />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
        )}

        {/* Columns Dropdown Button & Popover (Matching Nexus Journal 1:1) */}
            <div style={{ position: 'relative' }}>
              <button 
                type="button"
                onClick={() => setIsColumnsPopoverOpen(!isColumnsPopoverOpen)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 12px',
                  backgroundColor: 'var(--bg-card, #ffffff)',
                  border: '1px solid var(--border-color, #e5e7eb)',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: isColumnsPopoverOpen ? 'var(--text-primary, #111827)' : 'var(--text-secondary, #374151)',
                  cursor: 'pointer',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--border-hover, #d0d5dd)'}
                onMouseLeave={(e) => {
                  if (!isColumnsPopoverOpen) e.currentTarget.style.borderColor = 'var(--border-color, #e5e7eb)';
                }}
              >
                <Columns size={14} color="var(--text-secondary, #6b7280)" />
                <span>Columns</span>
              </button>

              <ColumnsPopover
                isOpen={isColumnsPopoverOpen}
                onClose={() => setIsColumnsPopoverOpen(false)}
                visibleCols={visibleCols}
                onToggleCol={onToggleCol}
                onSelectAll={onSelectAllCols}
                onDeselectAll={onDeselectAllCols}
                columnOrder={columnOrder}
                onReorderCols={onReorderCols}
                settings={settings}
                onUpdateSetting={onUpdateSetting}
              />
            </div>
          </>
        )}
      </div>

      {/* Column 2: Middle Action Icons (Centered relative to parent) */}
      {journalViewMode !== 'news' && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
          justifyContent: 'center',
          flexShrink: 0
        }}>
          {/* Hide/Mask values button */}
          {(!settings?.toolbarActions || settings.toolbarActions.find(a => a.id === 'statsMasking')?.enabled !== false) && (
            <button 
              onClick={() => setHideValues(!hideValues)}
              title={hideValues ? "Show P&L Values" : "Hide/Mask P&L Values"}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#6b7280',
                    cursor: 'pointer',
                    padding: '4px'
                  }}
                >
                  {hideValues ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              )}

              {/* Browse all chart images (matching Nexus Journal Image button) */}
              {(!settings?.toolbarActions || settings.toolbarActions.find(a => a.id === 'chartViewer')?.enabled !== false) && (
                <button 
                  onClick={onBrowseImagesClick || onViewChartClick}
                  title="Visual Chartbook"
                  aria-label="Visual Chartbook"
                  style={{ 
                    background: 'none', 
                    border: 'none', 
                    color: '#6b7280', 
                    cursor: 'pointer', 
                    padding: '4px',
                    borderRadius: '6px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'background-color 0.15s ease, transform 0.1s ease, color 0.15s ease'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.06)'; }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.transform = 'scale(1)';
                  }}
                  onMouseDown={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.12)';
                    e.currentTarget.style.transform = 'scale(0.95)';
                  }}
                  onMouseUp={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.06)';
                    e.currentTarget.style.transform = 'scale(1)';
                  }}
                >
                  <Image size={16} />
                </button>
              )}

              {journalViewMode === 'stats' && (
                <>

              {/* Add Trade Plus Icon */}
              {(!settings?.toolbarActions || settings.toolbarActions.find(a => a.id === 'addTrade')?.enabled !== false) && (
                <button 
                  onClick={onAddTradeClick}
                  title="Add New Trade"
                  style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', padding: '4px' }}
                >
                  <Plus size={18} />
                </button>
              )}

              {/* Upload / Import CSV Icon */}
              {(!settings?.toolbarActions || settings.toolbarActions.find(a => a.id === 'importTrades')?.enabled !== false) && (
                <button 
                  onClick={onImportClick}
                  title="Import Broker CSV"
                  style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', padding: '4px' }}
                >
                  <Upload size={16} />
                </button>
              )}

              {/* Download / Export Options Popover */}
              {(!settings?.toolbarActions || settings.toolbarActions.find(a => a.id === 'exportOptions')?.enabled !== false) && (
                <ExportDropdown 
                  trades={trades} 
                  portfolios={portfolios} 
                  capitalChanges={capitalChanges} 
                  settings={settings} 
                />
              )}
            </>
          )}
        </div>
      )}

      {/* Column 3: Right View Mode Icons (Anchored at the far right corner matching Nexus 1:1) */}
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        justifyContent: 'flex-end',
        minWidth: 0
      }}>
        {/* Segmented Sort By Pill: P&L | N | A (Placed on the left so view switcher remains permanently anchored at the right corner) */}
        {journalViewMode === 'portfolio' && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            backgroundColor: 'rgba(0, 0, 0, 0.04)',
            borderRadius: '9999px',
            padding: '2px',
            gap: '2px'
          }}>
            <button
              onClick={() => setSortBy && setSortBy('pl')}
              title="Sort by P&L"
              style={{
                fontSize: '10px',
                fontWeight: sortBy === 'pl' ? 700 : 500,
                padding: '2px 7px',
                borderRadius: '9999px',
                border: 'none',
                cursor: 'pointer',
                backgroundColor: sortBy === 'pl' ? 'var(--bg-card, #ffffff)' : 'transparent',
                color: sortBy === 'pl' ? 'var(--text-primary, #111827)' : 'var(--text-muted, #9ca3af)',
                boxShadow: sortBy === 'pl' ? '0 1px 2px rgba(0, 0, 0, 0.06)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              P&amp;L
            </button>
            <button
              onClick={() => setSortBy && setSortBy('name')}
              title="Sort by Name"
              style={{
                fontSize: '10px',
                fontWeight: sortBy === 'name' ? 700 : 500,
                padding: '2px 7px',
                borderRadius: '9999px',
                border: 'none',
                cursor: 'pointer',
                backgroundColor: sortBy === 'name' ? 'var(--bg-card, #ffffff)' : 'transparent',
                color: sortBy === 'name' ? 'var(--text-primary, #111827)' : 'var(--text-muted, #9ca3af)',
                boxShadow: sortBy === 'name' ? '0 1px 2px rgba(0, 0, 0, 0.06)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              N
            </button>
            <button
              onClick={() => setSortBy && setSortBy('allocation')}
              title="Sort by Allocation"
              style={{
                fontSize: '10px',
                fontWeight: sortBy === 'allocation' ? 700 : 500,
                padding: '2px 7px',
                borderRadius: '9999px',
                border: 'none',
                cursor: 'pointer',
                backgroundColor: sortBy === 'allocation' ? 'var(--bg-card, #ffffff)' : 'transparent',
                color: sortBy === 'allocation' ? 'var(--text-primary, #111827)' : 'var(--text-muted, #9ca3af)',
                boxShadow: sortBy === 'allocation' ? '0 1px 2px rgba(0, 0, 0, 0.06)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              A
            </button>
          </div>
        )}

        {/* 4-Pill View Mode Switcher (ALWAYS at the far right corner across ALL tabs) */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          backgroundColor: 'rgba(0, 0, 0, 0.04)',
          borderRadius: '9999px',
          padding: '2px',
          gap: '2px'
        }}>
          {/* Button 0: Stats Column Chart */}
          <button
            onClick={() => setJournalViewMode && setJournalViewMode('stats')}
            title="Summary Stat Cards"
            style={{
              position: 'relative',
              width: '26px',
              height: '26px',
              borderRadius: '50%',
              border: 'none',
              backgroundColor: 'transparent',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: journalViewMode === 'stats' ? 'var(--text-primary, #111827)' : 'var(--text-muted, #9ca3af)',
              transition: 'all 0.15s ease'
            }}>
            <BarChart2 size={14} strokeWidth={1.4} />
            {journalViewMode === 'stats' && (
              <span style={{
                position: 'absolute',
                bottom: '1px',
                left: '50%',
                transform: 'translateX(-50%)',
                width: '3.5px',
                height: '3.5px',
                borderRadius: '50%',
                backgroundColor: 'var(--text-primary, #111827)'
              }} />
            )}
          </button>

          {/* Button 1: Briefcase Active Positions & Portfolio DNA */}
          <button
            onClick={() => {
              if (setJournalViewMode) setJournalViewMode('portfolio');
              window.dispatchEvent(new CustomEvent('tradeontip_open_active_positions_cards'));
            }}
            title="Active Positions & Portfolio DNA"
            style={{
              position: 'relative',
              width: '26px',
              height: '26px',
              borderRadius: '50%',
              border: 'none',
              backgroundColor: 'transparent',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: journalViewMode === 'portfolio' ? 'var(--text-primary, #111827)' : 'var(--text-muted, #9ca3af)',
              transition: 'all 0.15s ease'
            }}>
            <Briefcase size={14} strokeWidth={1.4} />
            {journalViewMode === 'portfolio' && (
              <span style={{
                position: 'absolute',
                bottom: '1px',
                left: '50%',
                transform: 'translateX(-50%)',
                width: '3.5px',
                height: '3.5px',
                borderRadius: '50%',
                backgroundColor: 'var(--text-primary, #111827)'
              }} />
            )}
          </button>

          {/* Button 2: P&L Section & Holdings Matrix */}
          <button
            onClick={() => setJournalViewMode && setJournalViewMode('grid')}
            title="P&L Section & Holdings View"
            style={{
              position: 'relative',
              width: '26px',
              height: '26px',
              borderRadius: '50%',
              border: 'none',
              backgroundColor: 'transparent',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: journalViewMode === 'grid' ? 'var(--text-primary, #111827)' : 'var(--text-muted, #9ca3af)',
              transition: 'all 0.15s ease'
            }}>
            <PnlIcon size={15} />
            {journalViewMode === 'grid' && (
              <span style={{
                position: 'absolute',
                bottom: '-1px',
                left: '50%',
                transform: 'translateX(-50%)',
                width: '4px',
                height: '4px',
                borderRadius: '50%',
                backgroundColor: 'var(--text-primary, #111827)'
              }} />
            )}
          </button>

          {/* Button 3: NewsIcon / Live News Feed */}
          <button
            onClick={() => setJournalViewMode && setJournalViewMode('news')}
            title="Corporate Announcements & Live News Feed"
            style={{
              position: 'relative',
              width: '26px',
              height: '26px',
              borderRadius: '50%',
              border: 'none',
              backgroundColor: 'transparent',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: (journalViewMode === 'news' || journalViewMode === 'notes') ? 'var(--text-primary, #111827)' : 'var(--text-muted, #9ca3af)',
              transition: 'all 0.15s ease'
            }}>
            <NewsIcon size={15} variant="vector" />
            {(journalViewMode === 'news' || journalViewMode === 'notes') && (
              <span style={{
                position: 'absolute',
                bottom: '1px',
                left: '50%',
                transform: 'translateX(-50%)',
                width: '3.5px',
                height: '3.5px',
                borderRadius: '50%',
                backgroundColor: 'var(--text-primary, #111827)'
              }} />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
