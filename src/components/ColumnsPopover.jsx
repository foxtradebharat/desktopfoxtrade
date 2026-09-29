import React, { useState, useRef, useEffect } from 'react';
import { 
  GripVertical, Check, List, Activity, Target, IndianRupee, TrendingUp, 
  Flame, PieChart, TrendingDown, BarChart2, Shield, Zap, Sparkles, 
  Award, Wallet, Clock, Lock, CheckCircle2, ChevronRight, X
} from 'lucide-react';

export const JOURNAL_COLUMNS = [
  { id: 'tradeNo', label: 'Trade No.' },
  { id: 'date', label: 'Date' },
  { id: 'name', label: 'Stock Name' },
  { id: 'broker', label: 'Broker' },
  { id: 'setup', label: 'Setup' },
  { id: 'type', label: 'Buy/Sell' },
  { id: 'entry', label: 'Entry' },
  { id: 'avgEntry', label: 'Avg Entry' },
  { id: 'sl', label: 'SL' },
  { id: 'cmp', label: 'CMP' },
  { id: 'entryType', label: 'Entry Type' },
  { id: 'qty', label: 'Initial Qty/Lot' },
  { id: 'p1Price', label: 'P1 Price' },
  { id: 'p1Qty', label: 'P1 Qty/Lot' },
  { id: 'p1Date', label: 'P1 Date' },
  { id: 'p1Sl', label: 'P1 SL' },
  { id: 'p2Price', label: 'P2 Price' },
  { id: 'p2Qty', label: 'P2 Qty/Lot' },
  { id: 'p2Date', label: 'P2 Date' },
  { id: 'p2Sl', label: 'P2 SL' },
  { id: 'p3Price', label: 'P3 Price' },
  { id: 'p3Qty', label: 'P3 Qty/Lot' },
  { id: 'p3Date', label: 'P3 Date' },
  { id: 'p3Sl', label: 'P3 SL' },
  { id: 'p4Price', label: 'P4 Price' },
  { id: 'p4Qty', label: 'P4 Qty/Lot' },
  { id: 'p4Date', label: 'P4 Date' },
  { id: 'p4Sl', label: 'P4 SL' },
  { id: 'tsl', label: 'TSL' },
  { id: 'tslGroups', label: 'TSL Groups' },
  { id: 'positionSize', label: 'Position Size' },
  { id: 'currentAllocation', label: 'Current Allocation' },
  { id: 'peakAllocation', label: 'Peak Allocation' },
  { id: 'slPct', label: 'SL %' },
  { id: 'e1Price', label: 'Exit 1 Price' },
  { id: 'e1Qty', label: 'Exit 1 Qty/Lot' },
  { id: 'e1Date', label: 'Exit 1 Date' },
  { id: 'e2Price', label: 'Exit 2 Price' },
  { id: 'e2Qty', label: 'Exit 2 Qty/Lot' },
  { id: 'e2Date', label: 'Exit 2 Date' },
  { id: 'e3Price', label: 'Exit 3 Price' },
  { id: 'e3Qty', label: 'Exit 3 Qty/Lot' },
  { id: 'e3Date', label: 'Exit 3 Date' },
  { id: 'e4Price', label: 'Exit 4 Price' },
  { id: 'e4Qty', label: 'Exit 4 Qty/Lot' },
  { id: 'e4Date', label: 'Exit 4 Date' },
  { id: 'openQty', label: 'Open Qty/Lot' },
  { id: 'exitedQty', label: 'Exited Qty/Lot' },
  { id: 'avgExitPrice', label: 'Avg Exit Price' },
  { id: 'stockMove', label: 'Stock Move' },
  { id: 'rewardRisk', label: 'Reward:Risk' },
  { id: 'holdingDays', label: 'Holding Days' },
  { id: 'status', label: 'Position Status' },
  { id: 'realisedAmount', label: 'Realised Amount' },
  { id: 'grossPnl', label: 'Gross P/L ₹' },
  { id: 'pfImpact', label: 'PF Impact' },
  { id: 'cummPf', label: 'Cumm PF Impact' },
  { id: 'planFollowed', label: 'Plan Followed' },
  { id: 'exitTrigger', label: 'Exit Trigger' },
  { id: 'growthAreas', label: 'Growth Areas' },
  { id: 'capitalAtRisk', label: 'Capital at Risk' },
  { id: 'baseDuration', label: 'Base Duration' },
  { id: 'quickNote', label: 'Quick Note' },
  { id: 'unrealized', label: 'Unrealized P/L' },
  { id: 'actions', label: 'Actions' },
  { id: 'selfRating', label: 'SELF RATING' },
  { id: 'totalQtyBought', label: 'Total Qty Bought' },
  { id: 'mae', label: 'MAE (%)' },
  { id: 'mfe', label: 'MFE (%)' },
  { id: 'exchangeTradeIds', label: 'Exchange Trade IDs' },
  { id: 'transactionHistory', label: 'Transaction History' }
];

export const DEFAULT_VISIBLE_COL_IDS = [
  'tradeNo', 'date', 'name', 'broker', 'setup', 'type', 'entry', 'avgEntry', 'sl', 'cmp', 'entryType', 'qty',
  'p1Price', 'p1Qty', 'p1Date', 'p1Sl',
  'p2Price', 'p2Qty', 'p2Date', 'p2Sl',
  'p3Price', 'p3Qty', 'p3Date', 'p3Sl',
  'p4Price', 'p4Qty', 'p4Date', 'p4Sl',
  'tsl', 'tslGroups', 'positionSize', 'currentAllocation', 'peakAllocation', 'slPct',
  'e1Price', 'e1Qty', 'e1Date',
  'e2Price', 'e2Qty', 'e2Date',
  'e3Price', 'e3Qty', 'e3Date',
  'e4Price', 'e4Qty', 'e4Date',
  'openQty', 'exitedQty', 'avgExitPrice', 'stockMove', 'rewardRisk', 'holdingDays', 'status',
  'realisedAmount', 'grossPnl', 'pfImpact', 'cummPf', 'planFollowed', 'exitTrigger', 'growthAreas',
  'capitalAtRisk', 'baseDuration', 'quickNote', 'unrealized', 'actions'
];

export const DEFAULT_DASHBOARD_METRICS = [
  { id: 'totalTrades', label: 'Total Trades', enabled: true },
  { id: 'openPositions', label: 'Open Positions', enabled: true },
  { id: 'winRate', label: 'Win Rate', enabled: true },
  { id: 'realizedPnl', label: 'Realized P/L', enabled: true },
  { id: 'unrealizedPnl', label: 'Unrealized P/L', enabled: true },
  { id: 'capitalAtRisk', label: 'Capital at Risk', enabled: true },
  { id: 'profitRisk', label: 'Profit Risk', enabled: true },
  { id: 'profitProtected', label: 'Profit Protected', enabled: true },
  { id: 'pctInvested', label: '% Invested', enabled: true },
  { id: 'availableCash', label: 'Available Cash', enabled: false },
  { id: 'pfImpact', label: 'PF Impact %', enabled: true },
  { id: 'currentDd', label: 'CURRENT DD', enabled: true },
  { id: 'profitGiveback', label: 'Profit Giveback (Pre-tax)', enabled: false }
];

export const DEFAULT_TOOLBAR_ACTIONS = [
  { id: 'statsMasking', label: 'Stats Masking', enabled: true },
  { id: 'chartViewer', label: 'Chart Viewer', enabled: true },
  { id: 'addTrade', label: 'Add Trade', enabled: true },
  { id: 'importTrades', label: 'Import Trades', enabled: true },
  { id: 'exportOptions', label: 'Export Options', enabled: true },
  { id: 'autoSlBulk', label: 'Auto SL Bulk Action', enabled: false },
  { id: 'masterSync', label: 'All in one master sync', enabled: false, disabled: true, subtext: '(Requires multiple brokers)' },
  { id: 'dailySync', label: 'Daily Sync Broker', enabled: false, disabled: true, subtext: '(No connected accounts)' }
];

export const DEFAULT_VIEW_MODES = [
  { id: 'statsJournal', label: 'Stats/Journal View', enabled: true },
  { id: 'holdings', label: 'Holdings View', enabled: true },
  { id: 'brokers', label: 'Brokers View', enabled: true },
  { id: 'news', label: 'News View', enabled: true }
];

const AVAILABLE_ICONS = [
  { id: 'list', Icon: List, label: 'List' },
  { id: 'activity', Icon: Activity, label: 'Activity' },
  { id: 'target', Icon: Target, label: 'Target' },
  { id: 'rupee', Icon: IndianRupee, label: 'Rupee' },
  { id: 'trending-up', Icon: TrendingUp, label: 'Trending Up' },
  { id: 'flame', Icon: Flame, label: 'Flame' },
  { id: 'pie', Icon: PieChart, label: 'Pie Chart' },
  { id: 'trending-down', Icon: TrendingDown, label: 'Trending Down' },
  { id: 'bar', Icon: BarChart2, label: 'Bar Chart' },
  { id: 'shield', Icon: Shield, label: 'Shield' },
  { id: 'zap', Icon: Zap, label: 'Zap' },
  { id: 'sparkles', Icon: Sparkles, label: 'Sparkles' },
  { id: 'award', Icon: Award, label: 'Award' },
  { id: 'wallet', Icon: Wallet, label: 'Wallet' },
  { id: 'clock', Icon: Clock, label: 'Clock' },
  { id: 'lock', Icon: Lock, label: 'Lock' }
];

const ICON_COMPONENTS = {
  list: List,
  activity: Activity,
  target: Target,
  rupee: IndianRupee,
  'trending-up': TrendingUp,
  flame: Flame,
  pie: PieChart,
  'trending-down': TrendingDown,
  bar: BarChart2,
  shield: Shield,
  zap: Zap,
  sparkles: Sparkles,
  award: Award,
  wallet: Wallet,
  clock: Clock,
  lock: Lock
};

export default function ColumnsPopover({
  isOpen,
  onClose,
  visibleCols,
  onToggleCol,
  onSelectAll,
  onDeselectAll,
  columnOrder,
  onReorderCols,
  settings = {},
  onUpdateSetting
}) {
  const [activeTab, setActiveTab] = useState('columns'); // 'columns' | 'customize' | 'icons'
  const popoverRef = useRef(null);
  const [draggedId, setDraggedId] = useState(null);
  const [selectedIconPickerStat, setSelectedIconPickerStat] = useState(null);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isBuySell = settings?.columnTerminology === 'buySell';
  const getColLabel = (col) => {
    if (!col) return '';
    if (isBuySell) {
      if (col.id === 'p1Price') return 'B1 Price';
      if (col.id === 'p1Qty') return 'B1 Qty/Lot';
      if (col.id === 'p1Date') return 'B1 Date';
      if (col.id === 'p1Sl') return 'B1 SL';
      if (col.id === 'p2Price') return 'B2 Price';
      if (col.id === 'p2Qty') return 'B2 Qty/Lot';
      if (col.id === 'p2Date') return 'B2 Date';
      if (col.id === 'p2Sl') return 'B2 SL';
      if (col.id === 'p3Price') return 'B3 Price';
      if (col.id === 'p3Qty') return 'B3 Qty/Lot';
      if (col.id === 'p3Date') return 'B3 Date';
      if (col.id === 'p3Sl') return 'B3 SL';
      if (col.id === 'p4Price') return 'B4 Price';
      if (col.id === 'p4Qty') return 'B4 Qty/Lot';
      if (col.id === 'p4Date') return 'B4 Date';
      if (col.id === 'p4Sl') return 'B4 SL';
      if (col.id === 'e1Price') return 'Sell 1 Price';
      if (col.id === 'e1Qty') return 'Sell 1 Qty/Lot';
      if (col.id === 'e1Date') return 'Sell 1 Date';
      if (col.id === 'e2Price') return 'Sell 2 Price';
      if (col.id === 'e2Qty') return 'Sell 2 Qty/Lot';
      if (col.id === 'e2Date') return 'Sell 2 Date';
      if (col.id === 'e3Price') return 'Sell 3 Price';
      if (col.id === 'e3Qty') return 'Sell 3 Qty/Lot';
      if (col.id === 'e3Date') return 'Sell 3 Date';
      if (col.id === 'e4Price') return 'Sell 4 Price';
      if (col.id === 'e4Qty') return 'Sell 4 Qty/Lot';
      if (col.id === 'e4Date') return 'Sell 4 Date';
    }
    return col.label;
  };

  // Ordered list of columns based on user's current columnOrder
  const orderedColumns = (columnOrder && columnOrder.length > 0)
    ? columnOrder
        .map(id => JOURNAL_COLUMNS.find(c => c.id === id))
        .filter(Boolean)
        .concat(JOURNAL_COLUMNS.filter(c => !columnOrder.includes(c.id)))
    : JOURNAL_COLUMNS;

  // Drag and Drop reordering within popover
  const handleDragStart = (e, colId) => {
    setDraggedId(colId);
    e.dataTransfer.setData('text/plain', colId);
  };

  const handleDragOver = (e, overColId) => {
    e.preventDefault();
    if (!draggedId || draggedId === overColId) return;

    const currentList = orderedColumns.map(c => c.id);
    const draggedIdx = currentList.indexOf(draggedId);
    const overIdx = currentList.indexOf(overColId);
    if (draggedIdx === -1 || overIdx === -1) return;

    const updated = [...currentList];
    const [removed] = updated.splice(draggedIdx, 1);
    updated.splice(overIdx, 0, removed);

    if (onReorderCols) {
      onReorderCols(updated);
    }
  };

  const handleDragEnd = () => {
    setDraggedId(null);
  };

  // Customization state helpers
  const dashboardMetrics = settings.dashboardMetrics || DEFAULT_DASHBOARD_METRICS;
  const toolbarActions = settings.toolbarActions || DEFAULT_TOOLBAR_ACTIONS;
  const viewModes = settings.viewModes || DEFAULT_VIEW_MODES;
  const statIcons = settings.statIcons || {
    totalTrades: 'list',
    openPositions: 'activity',
    winRate: 'target',
    realizedPnl: 'rupee',
    unrealizedPnl: 'trending-up',
    capitalAtRisk: 'flame',
    pctInvested: 'pie',
    availableCash: 'rupee',
    pfImpact: 'list',
    currentDd: 'trending-down',
    profitGiveback: 'list'
  };

  const toggleCustomizeItem = (category, itemId) => {
    if (!onUpdateSetting) return;
    if (category === 'dashboardMetrics') {
      const updated = dashboardMetrics.map(item => item.id === itemId ? { ...item, enabled: !item.enabled } : item);
      onUpdateSetting('dashboardMetrics', updated);
    } else if (category === 'toolbarActions') {
      const updated = toolbarActions.map(item => item.id === itemId ? { ...item, enabled: !item.enabled } : item);
      onUpdateSetting('toolbarActions', updated);
    } else if (category === 'viewModes') {
      const updated = viewModes.map(item => item.id === itemId ? { ...item, enabled: !item.enabled } : item);
      onUpdateSetting('viewModes', updated);
    }
  };

  const setStatIcon = (statId, iconKey) => {
    if (!onUpdateSetting) return;
    const updated = { ...statIcons, [statId]: iconKey };
    onUpdateSetting('statIcons', updated);
    setSelectedIconPickerStat(null);
  };

  return (
    <div
      ref={popoverRef}
      style={{
        position: 'absolute',
        top: 'calc(100% + 8px)',
        left: 0,
        zIndex: 99999,
        width: '280px',
        maxHeight: '460px',
        backgroundColor: 'var(--bg-card, #ffffff)',
        borderRadius: '16px',
        border: '1px solid var(--border-color, rgba(0, 0, 0, 0.12))',
        boxShadow: '0 16px 48px -12px rgba(0, 0, 0, 0.25)',
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto',
        animation: 'modernDropdownFadeIn 0.15s ease-out',
        color: 'var(--text-primary, #111827)'
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Sticky Tab Switcher Header (Columns | Customize | Icons) */}
      <div style={{
        position: 'sticky',
        top: 0,
        zIndex: 10,
        backgroundColor: 'var(--bg-card, #ffffff)',
        padding: '6px 8px 8px 8px',
        borderBottom: '1px solid var(--border-color, rgba(0, 0, 0, 0.08))'
      }}>
        <div style={{
          display: 'inline-flex',
          width: '100%',
          padding: '2px',
          borderRadius: '9999px',
          backgroundColor: 'rgba(0, 0, 0, 0.04)',
          border: '1px solid var(--border-color, rgba(0, 0, 0, 0.06))'
        }}>
          {[
            { id: 'columns', label: 'Columns' },
            { id: 'customize', label: 'Customize' },
            { id: 'icons', label: 'Icons' }
          ].map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  flex: 1,
                  height: '26px',
                  padding: '0 10px',
                  borderRadius: '9999px',
                  border: isActive ? '1px solid rgba(0, 0, 0, 0.08)' : 'none',
                  backgroundColor: isActive ? 'var(--bg-card, #ffffff)' : 'transparent',
                  color: isActive ? 'var(--text-primary, #111827)' : 'var(--text-muted, #6b7280)',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  boxShadow: isActive ? '0 1px 3px rgba(0, 0, 0, 0.06)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── TAB 1: COLUMNS ──────────────────────────────────────────────── */}
      {activeTab === 'columns' && (
        <div style={{ padding: '6px 8px 10px 8px', display: 'flex', flexDirection: 'column' }}>
          {/* Select All */}
          <div 
            onClick={onSelectAll}
            style={{
              padding: '6px 6px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              cursor: 'pointer',
              userSelect: 'none',
              borderRadius: '6px'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.03)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', pointerEvents: 'none' }}>
              <input 
                type="checkbox" 
                checked={visibleCols && visibleCols.size === JOURNAL_COLUMNS.length}
                readOnly
                style={{ width: '14px', height: '14px', accentColor: '#111827', cursor: 'pointer' }}
              />
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary, #111827)' }}>
                Select All
              </span>
            </label>
          </div>

          {/* Deselect All */}
          <div 
            onClick={onDeselectAll}
            style={{
              padding: '6px 6px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              cursor: 'pointer',
              userSelect: 'none',
              borderRadius: '6px'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.03)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', pointerEvents: 'none' }}>
              <input 
                type="checkbox" 
                checked={false}
                readOnly
                style={{ width: '14px', height: '14px', accentColor: '#111827', cursor: 'pointer' }}
              />
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary, #111827)' }}>
                Deselect All
              </span>
            </label>
          </div>

          {/* Separator */}
          <div style={{ height: '1px', backgroundColor: 'var(--border-color, rgba(0,0,0,0.08))', margin: '6px 0 6px 0' }} />

          {/* Column Items */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
            {orderedColumns.map((col) => {
              const isChecked = visibleCols && visibleCols.has(col.id);
              const isDragging = draggedId === col.id;

              return (
                <div
                  key={col.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, col.id)}
                  onDragOver={(e) => handleDragOver(e, col.id)}
                  onDragEnd={handleDragEnd}
                  onClick={() => onToggleCol(col.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '4px 6px',
                    minHeight: '32px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    opacity: isDragging ? 0.35 : 1,
                    backgroundColor: isDragging ? 'rgba(0,0,0,0.04)' : 'transparent',
                    userSelect: 'none',
                    transition: 'background-color 0.1s ease'
                  }}
                  onMouseEnter={(e) => {
                    if (!isDragging) e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.035)';
                  }}
                  onMouseLeave={(e) => {
                    if (!isDragging) e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <button
                    type="button"
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: '2px',
                      cursor: 'grab',
                      color: '#9ca3af',
                      display: 'flex',
                      alignItems: 'center'
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <GripVertical size={14} color="#9ca3af" />
                  </button>
                  <span style={{
                    flex: 1,
                    fontSize: '13px',
                    fontWeight: isChecked ? 600 : 400,
                    color: isChecked ? 'var(--text-primary, #111827)' : 'var(--text-muted, #6b7280)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {getColLabel(col)}
                  </span>
                  <input
                    type="checkbox"
                    checked={Boolean(isChecked)}
                    onChange={() => onToggleCol(col.id)}
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      width: '14px',
                      height: '14px',
                      accentColor: '#111827',
                      cursor: 'pointer',
                      flexShrink: 0
                    }}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── TAB 2: CUSTOMIZE ────────────────────────────────────────────── */}
      {activeTab === 'customize' && (
        <div style={{ padding: '6px 8px 12px 8px', display: 'flex', flexDirection: 'column' }}>
          {/* Section 1: Customize Dashboard */}
          <div style={{ padding: '6px 6px 4px 6px', display: 'flex', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted, #9ca3af)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Customize Dashboard
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
            {dashboardMetrics.map((item) => (
              <div
                key={item.id}
                onClick={() => toggleCustomizeItem('dashboardMetrics', item.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '5px 6px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  userSelect: 'none',
                  transition: 'background-color 0.1s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.035)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <GripVertical size={14} color="#cbd5e1" style={{ marginRight: '6px', cursor: 'grab' }} />
                <span style={{ flex: 1, fontSize: '13px', color: item.enabled ? 'var(--text-primary, #111827)' : 'var(--text-muted, #9ca3af)', fontWeight: item.enabled ? 600 : 400 }}>
                  {item.label}
                </span>
                {item.enabled && <Check size={14} color="var(--text-primary, #111827)" strokeWidth={2.5} />}
              </div>
            ))}
          </div>

          {/* Separator */}
          <div style={{ height: '1px', backgroundColor: 'var(--border-color, rgba(0,0,0,0.08))', margin: '8px 0 6px 0' }} />

          {/* Section 2: Quick Action Toolbar */}
          <div style={{ padding: '6px 6px 4px 6px', display: 'flex', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted, #9ca3af)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Quick Action Toolbar
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
            {toolbarActions.map((item) => (
              <div
                key={item.id}
                onClick={() => !item.disabled && toggleCustomizeItem('toolbarActions', item.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '5px 6px',
                  borderRadius: '6px',
                  cursor: item.disabled ? 'not-allowed' : 'pointer',
                  opacity: item.disabled ? 0.45 : 1,
                  userSelect: 'none',
                  transition: 'background-color 0.1s ease'
                }}
                onMouseEnter={(e) => {
                  if (!item.disabled) e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.035)';
                }}
                onMouseLeave={(e) => {
                  if (!item.disabled) e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <GripVertical size={14} color="#cbd5e1" style={{ marginRight: '6px', cursor: 'grab' }} />
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '4px', overflow: 'hidden' }}>
                  <span style={{ fontSize: '13px', color: item.enabled ? 'var(--text-primary, #111827)' : 'var(--text-muted, #9ca3af)', fontWeight: item.enabled ? 600 : 400 }}>
                    {item.label}
                  </span>
                  {item.subtext && (
                    <span style={{ fontSize: '10px', color: '#9ca3af', whiteSpace: 'nowrap' }}>
                      {item.subtext}
                    </span>
                  )}
                </div>
                {item.enabled && <Check size={14} color="var(--text-primary, #111827)" strokeWidth={2.5} />}
              </div>
            ))}
          </div>

          {/* Separator */}
          <div style={{ height: '1px', backgroundColor: 'var(--border-color, rgba(0,0,0,0.08))', margin: '8px 0 6px 0' }} />

          {/* Section 3: View Mode Options */}
          <div style={{ padding: '6px 6px 4px 6px', display: 'flex', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted, #9ca3af)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              View Mode Options
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
            {viewModes.map((item) => (
              <div
                key={item.id}
                onClick={() => toggleCustomizeItem('viewModes', item.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '5px 6px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  userSelect: 'none',
                  transition: 'background-color 0.1s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.035)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <GripVertical size={14} color="#cbd5e1" style={{ marginRight: '6px', cursor: 'grab' }} />
                <span style={{ flex: 1, fontSize: '13px', color: item.enabled ? 'var(--text-primary, #111827)' : 'var(--text-muted, #9ca3af)', fontWeight: item.enabled ? 600 : 400 }}>
                  {item.label}
                </span>
                {item.enabled && <Check size={14} color="var(--text-primary, #111827)" strokeWidth={2.5} />}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── TAB 3: ICONS ────────────────────────────────────────────────── */}
      {activeTab === 'icons' && (
        <div style={{ padding: '6px 8px 12px 8px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '6px 6px 4px 6px', display: 'flex', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted, #9ca3af)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Stats Icons
            </span>
          </div>

          {/* List of Stats with clickable icon picker */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {[
              { id: 'totalTrades', label: 'Total Trades' },
              { id: 'openPositions', label: 'Open Positions' },
              { id: 'winRate', label: 'Win Rate' },
              { id: 'realizedPnl', label: 'Realized P/L' },
              { id: 'unrealizedPnl', label: 'Unrealized P/L' },
              { id: 'capitalAtRisk', label: 'Capital Heat' },
              { id: 'pctInvested', label: '% Invested' },
              { id: 'availableCash', label: 'Available Cash' },
              { id: 'pfImpact', label: 'PF Impact' },
              { id: 'currentDd', label: 'CURRENT DD' },
              { id: 'profitGiveback', label: 'Profit Giveback (Pre-tax)' }
            ].map(stat => {
              const currentIconKey = statIcons[stat.id] || 'list';
              const IconComp = ICON_COMPONENTS[currentIconKey] || List;
              const isPickerOpen = selectedIconPickerStat === stat.id;

              return (
                <div key={stat.id} style={{ display: 'flex', flexDirection: 'column' }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '4px 6px',
                    borderRadius: '6px'
                  }}>
                    <span style={{ fontSize: '13px', color: 'var(--text-primary, #111827)', fontWeight: 500 }}>
                      {stat.label}
                    </span>

                    <button
                      type="button"
                      onClick={() => setSelectedIconPickerStat(isPickerOpen ? null : stat.id)}
                      title={`Change icon for ${stat.label}`}
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '6px',
                        border: isPickerOpen ? '1px solid #111827' : '1px solid var(--border-color, #e5e7eb)',
                        backgroundColor: isPickerOpen ? 'rgba(0,0,0,0.06)' : 'var(--bg-card, #ffffff)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        color: 'var(--text-primary, #111827)',
                        transition: 'all 0.15s ease'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.borderColor = '#9ca3af'}
                      onMouseLeave={(e) => {
                        if (!isPickerOpen) e.currentTarget.style.borderColor = 'var(--border-color, #e5e7eb)';
                      }}
                    >
                      <IconComp size={16} />
                    </button>
                  </div>

                  {/* Inline Icon Grid Picker when expanded */}
                  {isPickerOpen && (
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(4, 1fr)',
                      gap: '4px',
                      padding: '8px',
                      marginTop: '4px',
                      marginBottom: '6px',
                      backgroundColor: 'rgba(0,0,0,0.03)',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color, rgba(0,0,0,0.08))'
                    }}>
                      {AVAILABLE_ICONS.map(ic => {
                        const ItemIcon = ic.Icon;
                        const isSelected = currentIconKey === ic.id;
                        return (
                          <button
                            key={ic.id}
                            type="button"
                            onClick={() => setStatIcon(stat.id, ic.id)}
                            title={ic.label}
                            style={{
                              height: '30px',
                              borderRadius: '6px',
                              border: isSelected ? '1px solid #111827' : '1px solid rgba(0,0,0,0.06)',
                              backgroundColor: isSelected ? '#111827' : 'var(--bg-card, #ffffff)',
                              color: isSelected ? '#ffffff' : '#374151',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer'
                            }}
                          >
                            <ItemIcon size={14} />
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
