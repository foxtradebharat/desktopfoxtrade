import React, { useState, useEffect, useRef } from 'react';
import { 
  BookOpenCheck, BarChart2, Activity, Calculator, Wallet, 
  BrainCircuit, Pencil, Cloud, Settings, Compass, Sparkles, Target
} from 'lucide-react';
import CloudSyncPopover from './CloudSyncPopover';
import AccountSettingsPopover from './AccountSettingsPopover';
import RestoreBackupModal from './RestoreBackupModal';
import FoxTradeLogo from './FoxTradeLogo';
import PlaybookIcon from './Playbook/PlaybookIcon';
import FoxyAiIcon from './FoxyAiIcon';
import { subscribeToSyncStatus, subscribeToSyncError, setSyncError } from '../db/index.js';
import { saveTradesToDrive } from '../services/driveService.js';
import { getValidAccessToken } from '../db/tokenManager.js';
import { bulkPutTrades } from '../db/tradeStore.js';
import { requestOfflineRefreshToken } from '../services/googleDrive.js';

export default function BottomDock({ 
  activeTab, 
  setActiveTab, 
  onLogout,
  autoBackup,
  setAutoBackup,
  backupWarning,
  accessToken,
  trades,
  onGoogleDriveSyncClick,
  user,
  portfolios = [],
  activePortfolioId = 'portfolio-default',
  onSelectPortfolio,
  activePortfolioName = 'My Portfolio',
  onOpenPortfolioModal,
  onOpenBrokerConnections,
  onOpenDisplaySettings,
  onOpenTradeSettings,
  onClearAllData,
  onTradesRestored,
  onShowToast,
  onGoogleLogin
}) {
  const [isCloudOpen, setIsCloudOpen] = useState(false);
  const [isAccountSettingsOpen, setIsAccountSettingsOpen] = useState(false);
  const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncErrorState] = useState(null);
  const [hasValidDriveToken, setHasValidDriveToken] = useState(false);
  const settingsAnchorRef = useRef(null);

  const isDemo = Boolean(!user || user.uid?.startsWith('demo-') || user.email?.includes('demo@'));

  // Detect genuine Google Drive token state
  useEffect(() => {
    if (isDemo) {
      setHasValidDriveToken(false);
      return;
    }
    if (accessToken && accessToken !== 'demo-token') {
      setHasValidDriveToken(true);
      return;
    }
    getValidAccessToken()
      .then(tok => setHasValidDriveToken(Boolean(tok && tok !== 'demo-token')))
      .catch(() => setHasValidDriveToken(false));
  }, [accessToken, user?.uid, isDemo]);

  const isDriveConnected = !isDemo && (Boolean(accessToken && accessToken !== 'demo-token') || hasValidDriveToken);

  // Subscribe to real-time syncing status from DB syncEngine
  useEffect(() => {
    return subscribeToSyncStatus(setIsSyncing);
  }, []);

  // Subscribe to Google Drive sync errors
  useEffect(() => {
    return subscribeToSyncError(setSyncErrorState);
  }, []);

  // Exact tabs matching Nexus Journal order with dedicated Playbook engine
  const navTabs = [
    { id: 'journal', label: 'Journal', icon: BookOpenCheck },
    { id: 'analytics', label: 'Analytics', icon: BarChart2 },
    { id: 'playbook', label: 'Playbook', icon: PlaybookIcon },
    { id: 'stock-charts', label: 'Stock Charts', icon: Activity },
    { id: 'tax-analytics', label: 'Tax Analytics', icon: Calculator },
    { id: 'fund-management', label: 'Fund Management', icon: Wallet },
    { id: 'deep-analytics', label: 'Deep Analytics', icon: BrainCircuit },
    { id: 'notes', label: 'Notes', icon: Pencil },
    { id: 'foxy-ai', label: 'Foxy Ai', icon: FoxyAiIcon },
  ];

  return (
    <header style={{
      position: 'fixed',
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 60,
      borderTop: '1px solid var(--border-color, rgba(229, 231, 235, 0.8))',
      backgroundColor: 'var(--bg-surface, rgba(255, 255, 255, 0.95))',
      backdropFilter: 'blur(20px)',
      boxShadow: '0 -2px 12px rgba(0, 0, 0, 0.06)',
      paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 4px)',
      transition: 'background-color 0.2s, border-color 0.2s'
    }}>
      <nav style={{
        display: 'grid',
        width: '100%',
        minWidth: 0,
        alignItems: 'center',
        minHeight: '54px',
        gridTemplateColumns: 'auto minmax(0, 1fr) auto',
        padding: '0 16px'
      }}>
        {/* ── Left: FoxTrade Logo & Brand ───────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingLeft: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }} onClick={() => setActiveTab('journal')}>
            <FoxTradeLogo size={24} />
            <span style={{
              letterSpacing: '0.15em',
              fontSize: '11px',
              fontWeight: 800,
              color: 'var(--text-primary, #111827)',
              fontFamily: 'Inter, system-ui, sans-serif'
            }}>
              FOXTRADE
            </span>
          </div>
          <span style={{ width: '1px', height: '20px', backgroundColor: 'var(--border-color, #e5e7eb)', margin: '0 4px' }} />
        </div>

        {/* ── Center: Main Tab Navigation Items ─────────────────────────────── */}
        <div style={{ minWidth: 0, overflowX: 'auto', display: 'flex', justifyContent: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0 12px' }}>
            {navTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    whiteSpace: 'nowrap',
                    borderRadius: '12px',
                    border: isActive ? '1px solid var(--border-color)' : '1px solid transparent',
                    fontWeight: 600,
                    padding: '7px 14px',
                    fontSize: '12px',
                    color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
                    backgroundColor: isActive ? 'var(--bg-hover)' : 'transparent',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
                      e.currentTarget.style.color = 'var(--text-primary)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                      e.currentTarget.style.color = 'var(--text-muted)';
                    }
                  }}
                >
                  <Icon size={tab.id === 'playbook' || tab.id === 'foxy-ai' ? 15 : 14} strokeWidth={2} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Right: Cloud Status, Settings & Broker Badge ──────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px', paddingRight: '8px' }}>
          
          {/* Cloud Sync Status with Live Syncing Animation */}
          <div style={{ position: 'relative' }}>
            <button 
              title={
                syncError 
                  ? `Drive Backup Error: ${syncError}` 
                  : isSyncing 
                    ? "Syncing to Google Drive..." 
                    : isDriveConnected 
                      ? "Cloud Sync Active (Google Drive)" 
                      : "Google Drive Disconnected"
              }
              onClick={() => setIsCloudOpen(!isCloudOpen)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                border: syncError ? '1px solid rgba(239, 68, 68, 0.35)' : 'none',
                backgroundColor: syncError 
                  ? 'rgba(239, 68, 68, 0.12)' 
                  : isSyncing 
                    ? 'rgba(59, 130, 246, 0.1)' 
                    : 'transparent',
                color: syncError 
                  ? '#ef4444' 
                  : isSyncing 
                    ? '#3b82f6' 
                    : isCloudOpen 
                      ? '#10b981' 
                      : isDriveConnected 
                        ? '#10b981' 
                        : 'var(--text-muted, #71717a)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                position: 'relative'
              }}>
              <Cloud 
                size={15} 
                strokeWidth={1.5} 
                className={isSyncing ? 'animate-pulse' : ''}
              />
              {isSyncing && (
                <span style={{
                  position: 'absolute',
                  top: '5px',
                  right: '5px',
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor: '#3b82f6',
                  boxShadow: '0 0 6px #3b82f6'
                }} />
              )}
              {syncError && !isSyncing && (
                <span style={{
                  position: 'absolute',
                  top: '4px',
                  right: '4px',
                  width: '7px',
                  height: '7px',
                  borderRadius: '50%',
                  backgroundColor: '#ef4444',
                  boxShadow: '0 0 8px #ef4444'
                }} />
              )}
            </button>

            <CloudSyncPopover
              isOpen={isCloudOpen}
              onClose={() => setIsCloudOpen(false)}
              autoBackup={autoBackup}
              setAutoBackup={setAutoBackup}
              isConnected={isDriveConnected && !syncError}
              syncError={syncError}
              onLogout={onLogout}
              onShowToast={onShowToast}
              onReconnectDrive={async () => {
                if (onGoogleLogin) {
                  try {
                    const res = await onGoogleLogin();
                    if (res?.accessToken) {
                      setSyncError(null);
                      const backupRes = await saveTradesToDrive(trades, res.accessToken, activePortfolioId);
                      if (backupRes?.success) {
                        setSyncError(null);
                        if (onShowToast) {
                          onShowToast({
                            title: 'Google Drive Connected',
                            description: 'Session refreshed and backup synced successfully.',
                            type: 'success'
                          });
                        }
                      }
                      // Asynchronously acquire 30-day refresh token via CF Worker
                      requestOfflineRefreshToken(res.user?.email).catch(() => {});
                    }
                  } catch (e) {
                    console.warn('[BottomDock] Reconnect Google Drive error:', e);
                  }
                }
              }}
              onBackupNow={async () => {
                try {
                  let token = await getValidAccessToken().catch(() => accessToken);
                  if (!token || token === 'demo-token') {
                    if (onGoogleLogin) {
                      const res = await onGoogleLogin();
                      token = res?.accessToken;
                    }
                  }
                  if (!token || token === 'demo-token') {
                    const msg = 'Google Drive session expired. Please click Reconnect Google Drive.';
                    setSyncError(msg);
                    if (onShowToast) {
                      onShowToast({
                        title: 'Google Sign-In Required',
                        message: msg,
                        type: 'error'
                      });
                    }
                    return;
                  }

                  if (!trades || trades.length === 0) {
                    if (onShowToast) {
                      onShowToast({
                        title: 'No Trades Found',
                        message: 'No trades available to backup.',
                        type: 'info'
                      });
                    }
                    return;
                  }

                  const res = await saveTradesToDrive(trades, token, activePortfolioId);
                  if (res && res.success && res.mode === 'drive') {
                    setSyncError(null);
                    if (onShowToast) {
                      onShowToast({
                        title: 'Backup Created',
                        message: `Saved ${trades.length} trades to Google Drive`,
                        type: 'success'
                      });
                    }
                  } else {
                    const errMsg = res?.error || 'Failed to upload backup to Google Drive.';
                    setSyncError(errMsg);
                    if (onShowToast) {
                      onShowToast({
                        title: 'Drive Backup Error',
                        message: errMsg,
                        type: 'error'
                      });
                    }
                  }
                } catch (err) {
                  console.error('[BottomDock] Drive Backup Error:', err);
                  setSyncError(err.message);
                  if (onShowToast) {
                    onShowToast({
                      title: 'Drive Backup Error',
                      message: err.message || 'Failed to save to Google Drive.',
                      type: 'error'
                    });
                  }
                }
              }}
              onOpenRestoreModal={() => {
                setIsCloudOpen(false);
                setIsRestoreModalOpen(true);
              }}
            />
          </div>

          {/* Account Settings Pill Button & Floating Popover */}
          <div style={{ position: 'relative' }}>
            <button
              ref={settingsAnchorRef}
              onClick={(e) => {
                e.stopPropagation();
                setIsAccountSettingsOpen(prev => !prev);
              }}
              aria-label="Account Settings"
              title="Account & Portfolio Settings"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                borderRadius: '9999px',
                border: '1px solid var(--border-color, #e5e7eb)',
                backgroundColor: isAccountSettingsOpen ? 'var(--bg-hover)' : 'transparent',
                color: 'var(--text-primary, #111827)',
                padding: '6px 10px',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'background-color 0.15s'
              }}
              onMouseEnter={(e) => {
                if (!isAccountSettingsOpen) e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
              }}
              onMouseLeave={(e) => {
                if (!isAccountSettingsOpen) e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <Settings size={14} strokeWidth={2} />
            </button>

            <AccountSettingsPopover
              isOpen={isAccountSettingsOpen}
              onClose={() => setIsAccountSettingsOpen(false)}
              anchorRef={settingsAnchorRef}
              user={user}
              isDemo={isDemo}
              onGoogleLogin={onGoogleLogin}
              onLogout={onLogout}
              onOpenBrokerConnections={onOpenBrokerConnections}
              onOpenDisplaySettings={onOpenDisplaySettings}
              onOpenTradeSettings={onOpenTradeSettings}
              onClearAllData={onClearAllData}
            />
          </div>

          {/* Broker Integration Badge (7+ Supported Brokers matching Nexus Journal) */}
          <div 
            onClick={onOpenBrokerConnections}
            title="Supported Brokers & Imports (7+ Available)"
            style={{
              marginLeft: '6px',
              paddingLeft: '8px',
              borderLeft: '1px solid var(--border-color, #e5e7eb)',
              display: 'flex',
              alignItems: 'center',
              position: 'relative',
              cursor: 'pointer'
            }}
          >
            <div style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              transition: 'background-color 0.15s ease'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.05)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <span style={{
                position: 'absolute',
                top: '-2px',
                right: '-4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '9999px',
                backgroundColor: 'var(--bg-surface, #ffffff)',
                color: 'var(--text-muted, #71717a)',
                boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
                border: '1px solid var(--border-color, #e5e7eb)',
                zIndex: 20,
                height: '14px',
                minWidth: '16px',
                padding: '0 3px',
                fontSize: '8px',
                fontWeight: 800
              }}>
                7+
              </span>
              <img
                alt="Zerodha Kite"
                src="https://kite.zerodha.com/static/images/kite-logo.svg"
                style={{ width: '22px', height: '22px', objectFit: 'contain', opacity: 0.85 }}
              />
            </div>
          </div>

        </div>
      </nav>

      {/* Restore Data & Backup History Modal */}
      <RestoreBackupModal
        isOpen={isRestoreModalOpen}
        onClose={() => setIsRestoreModalOpen(false)}
        activePortfolioId={activePortfolioId}
        activePortfolioName={activePortfolioName}
        currentTrades={trades}
        accessToken={accessToken}
        onTradesRestored={onTradesRestored}
        onShowToast={onShowToast}
      />
    </header>
  );
}
