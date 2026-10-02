import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  History, 
  RefreshCw, 
  Upload, 
  Download, 
  Trash2, 
  Sliders, 
  Check, 
  X, 
  FileText, 
  ShieldCheck, 
  Layers, 
  ChevronDown,
  Cloud,
  TrendingUp,
  TrendingDown,
  Calendar,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { 
  listDriveBackups, 
  downloadBackupFileById, 
  deleteBackupFileById, 
  parseDrivePayload, 
  mergeTradeArrays, 
  bulkPutTrades, 
  clearTrades, 
  getTradesWithDeleted,
  getValidAccessToken,
  getConfig,
  setConfig,
  mergeFoxyChats,
  mergeFoxyCommitments,
  saveCalendarNotes,
  saveIndependentNotes,
} from '../db/index.js';
import { requestAccessToken } from '../services/googleDrive.js';

function formatRelativeTime(isoString) {
  if (!isoString) return 'recently';
  const ms = new Date(isoString).getTime();
  if (isNaN(ms)) return 'recently';
  const elapsedSec = Math.floor((Date.now() - ms) / 1000);
  if (elapsedSec < 30) return 'just now';
  if (elapsedSec < 60) return `${elapsedSec}s ago`;
  const mins = Math.floor(elapsedSec / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 KB';
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

// Custom Minimalist Dropdown (Replaces native OS select)
function MinimalDropdown({ label, value, onChange, options, description }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const selectedOption = options.find(o => o.value === value) || options[0];

  return (
    <div style={{ position: 'relative' }} ref={dropdownRef}>
      <label style={{ 
        display: 'block', 
        fontSize: '10px', 
        fontWeight: 700, 
        textTransform: 'uppercase', 
        letterSpacing: '0.04em',
        color: 'var(--text-muted, #6b7280)', 
        marginBottom: '6px' 
      }}>
        {label}
      </label>

      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        style={{
          width: '100%',
          padding: '8px 12px',
          borderRadius: '8px',
          border: '1px solid var(--border-color, #e5e7eb)',
          backgroundColor: 'var(--bg-primary, #ffffff)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '12px',
          fontWeight: 600,
          color: 'var(--text-primary, #111827)',
          cursor: 'pointer',
          outline: 'none',
          boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
          transition: 'border-color 0.15s ease'
        }}
      >
        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {selectedOption.label}
        </span>
        <ChevronDown size={13} style={{ opacity: 0.6, flexShrink: 0, marginLeft: '6px' }} />
      </button>

      {/* Floating Menu */}
      {isOpen && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 4px)',
          left: 0,
          right: 0,
          backgroundColor: 'var(--bg-surface, #ffffff)',
          border: '1px solid var(--border-color, #e5e7eb)',
          borderRadius: '10px',
          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.25)',
          padding: '4px',
          zIndex: 100,
          display: 'flex',
          flexDirection: 'column',
          gap: '2px'
        }}>
          {options.map(opt => {
            const isSelected = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '7px 10px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: isSelected ? 'rgba(59, 130, 246, 0.12)' : 'transparent',
                  color: isSelected ? '#3b82f6' : 'var(--text-primary, #111827)',
                  fontSize: '11px',
                  fontWeight: isSelected ? 700 : 500,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background-color 0.1s ease'
                }}
                onMouseEnter={e => {
                  if (!isSelected) e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
                }}
                onMouseLeave={e => {
                  if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <span>{opt.label}</span>
                {isSelected && <Check size={13} color="#3b82f6" />}
              </button>
            );
          })}
        </div>
      )}

      {description && (
        <div style={{ fontSize: '10px', color: 'var(--text-muted, #9ca3af)', marginTop: '4px', lineHeight: 1.3 }}>
          {description}
        </div>
      )}
    </div>
  );
}

export default function RestoreBackupModal({
  isOpen,
  onClose,
  activePortfolioId = 'default',
  activePortfolioName = 'My Portfolio',
  currentTrades = [],
  accessToken,
  onTradesRestored,
  onShowToast
}) {
  const [backups, setBackups] = useState([]);
  const [selectedBackup, setSelectedBackup] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [selectedBackupData, setSelectedBackupData] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [isConnectingDrive, setIsConnectingDrive] = useState(false);

  // 5-Category Restore Scope Configuration
  const [journalStrategy, setJournalStrategy] = useState('merge'); // 'merge' | 'overwrite' | 'skip'
  const [monthlyStrategy, setMonthlyStrategy] = useState('overwrite'); // 'overwrite' | 'merge' | 'skip'
  const [taxStrategy, setTaxStrategy] = useState('overwrite'); // 'overwrite' | 'merge' | 'skip'
  const [notesStrategy, setNotesStrategy] = useState('merge'); // 'merge' | 'overwrite' | 'skip'
  const [appSettingsStrategy, setAppSettingsStrategy] = useState('restore'); // 'restore' | 'skip'

  // Features toggles
  const [restoreImages, setRestoreImages] = useState(true);
  const [restoreBrokerKeys, setRestoreBrokerKeys] = useState(false);

  // File Upload Ref
  const fileInputRef = useRef(null);

  // Fetch Available Backups from Google Drive on open
  useEffect(() => {
    if (!isOpen) return;
    loadBackups();
  }, [isOpen, accessToken]);

  const loadBackups = async () => {
    setIsLoading(true);
    try {
      const token = await getValidAccessToken().catch(() => accessToken);
      let driveList = [];
      if (token && token !== 'demo-token') {
        driveList = await listDriveBackups(token);
      }

      // Also create a local backup snapshot entry if trades exist in IDB
      const list = [...driveList];
      if (currentTrades && currentTrades.length > 0) {
        list.unshift({
          id: 'local-snapshot',
          name: `local-snapshot-${activePortfolioId}.json`,
          size: JSON.stringify(currentTrades).length,
          modifiedTime: new Date().toISOString(),
          isLocal: true,
          portfolioId: activePortfolioId,
          tradeCount: currentTrades.length
        });
      }

      setBackups(list);
      if (list.length > 0 && !selectedBackup) {
        handleSelectBackup(list[0]);
      }
    } catch (err) {
      console.warn('[RestoreBackupModal] Error listing backups:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectBackup = async (backup) => {
    setSelectedBackup(backup);
    setLoadingDetails(true);

    try {
      if (backup.isLocal) {
        setSelectedBackupData({
          trades: currentTrades,
          version: '3.0',
          exportedAt: backup.modifiedTime,
          metadata: { tradeCount: currentTrades.length }
        });
      } else if (backup.isLocalUpload) {
        setSelectedBackupData(backup.data);
      } else {
        const token = await getValidAccessToken().catch(() => accessToken);
        if (token) {
          const data = await downloadBackupFileById(backup.id, token);
          if (data) {
            setSelectedBackupData(data);
          }
        }
      }
    } catch (err) {
      console.warn('[RestoreBackupModal] Error fetching backup details:', err);
    } finally {
      setLoadingDetails(false);
    }
  };

  // Connect Google Drive directly from modal empty state
  const handleConnectDrive = async () => {
    setIsConnectingDrive(true);
    try {
      const token = await requestAccessToken();
      if (token) {
        if (onShowToast) {
          onShowToast({
            title: 'Google Drive Connected',
            message: 'Loading cloud backups from your Drive...',
            type: 'success'
          });
        }
        await loadBackups();
      }
    } catch (err) {
      console.error('[RestoreBackupModal] Drive connect error:', err);
      if (onShowToast) {
        onShowToast({
          title: 'Connection Error',
          message: err.message || 'Could not connect to Google Drive',
          type: 'error'
        });
      }
    } finally {
      setIsConnectingDrive(false);
    }
  };

  // Upload Local File (.json or .gz)
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    try {
      const buffer = await file.arrayBuffer();
      const payload = await parseDrivePayload(buffer);

      if (!payload || !payload.trades) {
        throw new Error('Invalid backup file format — missing trades array');
      }

      const uploadedEntry = {
        id: `uploaded-${Date.now()}`,
        name: file.name,
        size: file.size,
        modifiedTime: new Date().toISOString(),
        isLocalUpload: true,
        portfolioId: payload.portfolioId || activePortfolioId,
        tradeCount: payload.trades.length,
        trades: payload.trades,
        data: payload
      };

      setBackups(prev => [uploadedEntry, ...prev]);
      setSelectedBackup(uploadedEntry);
      setSelectedBackupData(payload);

      if (onShowToast) {
        onShowToast({
          title: 'File Parsed',
          message: `Loaded ${payload.trades.length} trades from ${file.name}`,
          type: 'success'
        });
      }
    } catch (err) {
      console.error('[RestoreBackupModal] Upload error:', err);
      if (onShowToast) {
        onShowToast({
          title: 'Upload Failed',
          message: err.message || 'Could not parse backup file',
          type: 'error'
        });
      }
    } finally {
      setIsLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Download Backup File to User's Computer
  const handleDownloadBackup = async (e, backup) => {
    e.stopPropagation();
    try {
      let blob;
      if (backup.isLocal) {
        blob = new Blob([JSON.stringify({ version: '3.0', trades: currentTrades }, null, 2)], { type: 'application/json' });
      } else {
        const token = await getValidAccessToken().catch(() => accessToken);
        const data = await downloadBackupFileById(backup.id, token);
        blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = backup.name || `foxtrade-backup-${activePortfolioId}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('[RestoreBackupModal] Download error:', err);
    }
  };

  // Delete Backup from Drive
  const handleDeleteBackup = async (e, backup) => {
    e.stopPropagation();
    if (backup.isLocal || backup.isLocalUpload) {
      setBackups(prev => prev.filter(b => b.id !== backup.id));
      if (selectedBackup?.id === backup.id) {
        setSelectedBackup(null);
        setSelectedBackupData(null);
      }
      return;
    }

    if (!window.confirm(`Are you sure you want to delete backup "${backup.name}" from Google Drive?`)) {
      return;
    }

    try {
      const token = await getValidAccessToken().catch(() => accessToken);
      const ok = await deleteBackupFileById(backup.id, token);
      if (ok) {
        setBackups(prev => prev.filter(b => b.id !== backup.id));
        if (selectedBackup?.id === backup.id) {
          setSelectedBackup(null);
          setSelectedBackupData(null);
        }
        if (onShowToast) {
          onShowToast({
            title: 'Backup Deleted',
            message: 'Backup file removed from Google Drive',
            type: 'info'
          });
        }
      }
    } catch (err) {
      console.error('[RestoreBackupModal] Delete error:', err);
    }
  };

  // Perform Restore Action
  const handleRestoreSubmit = async () => {
    if (!selectedBackup) return;

    setIsRestoring(true);
    try {
      let remoteTrades = selectedBackupData?.trades || [];

      let backupPayload = selectedBackupData;
      if (!remoteTrades.length && !selectedBackup.isLocal) {
        const token = await getValidAccessToken().catch(() => accessToken);
        const data = await downloadBackupFileById(selectedBackup.id, token);
        backupPayload = data;
        remoteTrades = data?.trades || [];
      }

      // Restore daily & notebook notes from backup to both localStorage and IndexedDB
      if (backupPayload?.notes && typeof backupPayload.notes === 'object') {
        try { await saveCalendarNotes(backupPayload.notes); } catch {}
      }
      if (Array.isArray(backupPayload?.independentNotes)) {
        try { await saveIndependentNotes(backupPayload.independentNotes); } catch {}
      }

      // Restore Foxy AI chats with smart merge if present
      if (Array.isArray(backupPayload?.foxyChats) && backupPayload.foxyChats.length > 0) {
        try {
          const localChats = await getConfig('foxy_ai_chats', []);
          const mergedChats = mergeFoxyChats(localChats, backupPayload.foxyChats);
          await setConfig('foxy_ai_chats', mergedChats);
        } catch (e) {
          console.warn('[RestoreBackupModal] Restore foxyChats failed:', e);
        }
      }

      // Restore Foxy trader commitments with deduplication
      if (Array.isArray(backupPayload?.foxyCommitments) && backupPayload.foxyCommitments.length > 0) {
        try {
          const localComms = await getConfig('foxy_trader_commitments', []);
          const mergedComms = mergeFoxyCommitments(localComms, backupPayload.foxyCommitments);
          await setConfig('foxy_trader_commitments', mergedComms);
        } catch (e) {
          console.warn('[RestoreBackupModal] Restore foxyCommitments failed:', e);
        }
      }

      // Restore Foxy API key & settings if present
      if (backupPayload?.foxyConfig && typeof backupPayload.foxyConfig === 'object') {
        try {
          const localKey = await getConfig('foxy_ai_api_key', '');
          if (backupPayload.foxyConfig.apiKey && (!localKey || localKey.trim() === '')) {
            await setConfig('foxy_ai_api_key', backupPayload.foxyConfig.apiKey);
          }
          if (backupPayload.foxyConfig.provider) {
            await setConfig('foxy_ai_provider', backupPayload.foxyConfig.provider);
          }
          if (backupPayload.foxyConfig.model) {
            await setConfig('foxy_ai_model', backupPayload.foxyConfig.model);
          }
        } catch (e) {
          console.warn('[RestoreBackupModal] Restore foxyConfig failed:', e);
        }
      }

      if (!remoteTrades.length) {
        throw new Error('No trade entries found in this backup');
      }

      const targetPortfolio = selectedBackup.portfolioId || activePortfolioId;

      let finalTradesToSave = [];
      if (journalStrategy === 'merge') {
        const localAll = await getTradesWithDeleted(targetPortfolio);
        finalTradesToSave = mergeTradeArrays(localAll, remoteTrades);
      } else if (journalStrategy === 'overwrite') {
        await clearTrades(targetPortfolio);
        finalTradesToSave = remoteTrades;
      } else {
        // Skip journal restore
        finalTradesToSave = currentTrades;
      }

      if (journalStrategy !== 'skip') {
        await bulkPutTrades(targetPortfolio, finalTradesToSave, true);
      }

      // Notify parent Dashboard
      if (onTradesRestored && journalStrategy !== 'skip') {
        const activeTrades = finalTradesToSave.filter(t => !t.deletedAt);
        onTradesRestored(activeTrades);
      }

      if (onShowToast) {
        onShowToast({
          title: 'Restore Complete',
          message: `Successfully restored ${finalTradesToSave.filter(t => !t.deletedAt).length} trades into ${activePortfolioName}`,
          type: 'success'
        });
      }

      onClose();
    } catch (err) {
      console.error('[RestoreBackupModal] Restore error:', err);
      if (onShowToast) {
        onShowToast({
          title: 'Restore Failed',
          message: err.message || 'An error occurred during restore',
          type: 'error'
        });
      }
    } finally {
      setIsRestoring(false);
    }
  };

  if (!isOpen) return null;

  // ── Pre-Restore Intelligence Metrics ───────────────────────────────────────
  const backupTrades = selectedBackupData?.trades || [];
  const backupTradeCount = backupTrades.length || selectedBackup?.tradeCount || 0;

  const backupWinners = backupTrades.filter(t => (t.pnl || t.netPnl || 0) > 0).length;
  const backupWinRate = backupTradeCount > 0 
    ? ((backupWinners / backupTradeCount) * 100).toFixed(1) 
    : '0.0';

  const backupNetPnl = backupTrades.reduce((sum, t) => sum + (t.pnl || t.netPnl || 0), 0);

  // Compute diff against current local state
  const localTradeIds = new Set(currentTrades.map(t => t.id || t.uid));
  const newTradesIncoming = backupTrades.filter(t => !localTradeIds.has(t.id || t.uid)).length;

  return createPortal(
    <div 
      style={{
        position: 'fixed',
        top: 0, 
        left: 0, 
        right: 0, 
        bottom: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        boxSizing: 'border-box'
      }}
      onClick={onClose}
    >
      <div 
        style={{
          width: '100%',
          maxWidth: '850px',
          maxHeight: 'min(640px, 88vh)',
          backgroundColor: 'var(--bg-surface, #ffffff)',
          borderRadius: '16px',
          border: '1px solid var(--border-color, #e5e7eb)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          color: 'var(--text-primary, #111827)',
          fontFamily: "'Inter', sans-serif"
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div style={{
          padding: '14px 24px',
          borderBottom: '1px solid var(--border-color, #e5e7eb)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: 'var(--bg-surface, #ffffff)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '34px',
              height: '34px',
              borderRadius: '10px',
              backgroundColor: 'rgba(59, 130, 246, 0.1)',
              border: '1px solid rgba(59, 130, 246, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#3b82f6'
            }}>
              <History size={17} strokeWidth={2} />
            </div>
            <div>
              <h2 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>Restore Data</h2>
              <p style={{ fontSize: '11px', color: 'var(--text-muted, #6b7280)', margin: 0, marginTop: '1px' }}>
                Select a backup version to restore your portfolio state.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-muted, #9ca3af)',
              padding: '6px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background-color 0.15s ease'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-hover)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <X size={17} />
          </button>
        </div>

        {/* 2-Column Body Layout */}
        <div style={{ display: 'flex', flex: 1, minHeight: '440px', overflow: 'hidden' }}>
          
          {/* Left Column: Available Backups */}
          <div style={{
            width: '40%',
            borderRight: '1px solid var(--border-color, #e5e7eb)',
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: 'var(--bg-primary, #fafafa)'
          }}>
            {/* Left Header */}
            <div style={{
              padding: '12px 16px',
              borderBottom: '1px solid var(--border-color, #e5e7eb)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted, #6b7280)' }}>
                Available Backups
              </span>
              <button
                onClick={loadBackups}
                disabled={isLoading}
                title="Refresh backups list"
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-muted, #6b7280)',
                  padding: '4px',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
              </button>
            </div>

            {/* Backups List */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {backups.length === 0 ? (
                <div style={{ padding: '28px 16px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#3b82f6'
                  }}>
                    <Cloud size={20} />
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>No Cloud Backups Found</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted, #9ca3af)', maxWidth: '200px', lineHeight: 1.4 }}>
                    Connect Google Drive to load your cloud snapshots or upload a file.
                  </div>

                  <button
                    onClick={handleConnectDrive}
                    disabled={isConnectingDrive}
                    style={{
                      marginTop: '8px',
                      padding: '8px 14px',
                      borderRadius: '8px',
                      border: '1px solid rgba(59, 130, 246, 0.3)',
                      backgroundColor: 'rgba(59, 130, 246, 0.08)',
                      color: '#2563eb',
                      fontSize: '11px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <Cloud size={13} />
                    <span>{isConnectingDrive ? 'Connecting...' : 'Connect Google Drive'}</span>
                  </button>
                </div>
              ) : (
                backups.map(backup => {
                  const isSelected = selectedBackup?.id === backup.id;
                  return (
                    <div
                      key={backup.id}
                      onClick={() => handleSelectBackup(backup)}
                      style={{
                        padding: '11px 13px',
                        borderRadius: '12px',
                        border: isSelected 
                          ? '1.5px solid #3b82f6' 
                          : '1px solid var(--border-color, #e5e7eb)',
                        backgroundColor: isSelected 
                          ? 'rgba(59, 130, 246, 0.08)' 
                          : 'var(--bg-surface, #ffffff)',
                        boxShadow: isSelected 
                          ? '0 4px 12px rgba(59, 130, 246, 0.12)' 
                          : '0 1px 2px rgba(0,0,0,0.02)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{
                              width: '8px',
                              height: '8px',
                              borderRadius: '50%',
                              backgroundColor: backup.isLocal ? '#10b981' : '#3b82f6',
                              flexShrink: 0
                            }} />
                            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {backup.isLocal ? 'Current Local State' : (backup.name || 'FoxTrade Backup')}
                            </span>
                          </div>
                          
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px', color: 'var(--text-muted, #6b7280)', marginTop: '4px', paddingLeft: '16px' }}>
                            <span>{formatRelativeTime(backup.modifiedTime)}</span>
                            <span>•</span>
                            <span>{formatBytes(backup.size)}</span>
                            {backup.tradeCount !== undefined && (
                              <>
                                <span>•</span>
                                <span>{backup.tradeCount} trades</span>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Action buttons on card */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                          <button
                            onClick={(e) => handleDownloadBackup(e, backup)}
                            title="Download backup file"
                            style={{
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              padding: '4px',
                              borderRadius: '6px',
                              color: 'var(--text-muted, #9ca3af)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                            onMouseEnter={e => e.currentTarget.style.color = '#3b82f6'}
                            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted, #9ca3af)'}
                          >
                            <Download size={13} />
                          </button>

                          {!backup.isLocal && (
                            <button
                              onClick={(e) => handleDeleteBackup(e, backup)}
                              title="Delete backup"
                              style={{
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                padding: '4px',
                                borderRadius: '6px',
                                color: 'var(--text-muted, #9ca3af)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                              onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                              onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted, #9ca3af)'}
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Bottom Upload Dropzone */}
            <div style={{ padding: '12px', borderTop: '1px solid var(--border-color, #e5e7eb)' }}>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,.gz,.csv,application/json,application/gzip"
                style={{ display: 'none' }}
                onChange={handleFileUpload}
              />
              <div
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: '1.5px dashed var(--border-color, #d1d5db)',
                  borderRadius: '10px',
                  padding: '10px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  backgroundColor: 'var(--bg-surface, #ffffff)',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = '#3b82f6';
                  e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = 'var(--border-color, #d1d5db)';
                  e.currentTarget.style.backgroundColor = 'var(--bg-surface, #ffffff)';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                  <Upload size={13} color="#3b82f6" />
                  <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-primary)' }}>
                    Upload Backup File
                  </span>
                </div>
                <div style={{ fontSize: '9px', color: 'var(--text-muted, #9ca3af)', marginTop: '2px' }}>
                  Supports .json, .gz & .csv
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Restore Configuration & Intelligence */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '18px 22px', overflowY: 'auto', backgroundColor: 'var(--bg-surface, #ffffff)' }}>
            
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <Sliders size={14} color="#3b82f6" />
              <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted, #6b7280)' }}>
                Restore Configuration
              </span>
            </div>

            {/* Pre-Restore Intelligence & Diff Preview Card */}
            {selectedBackup && (
              <div style={{
                padding: '12px 14px',
                borderRadius: '12px',
                backgroundColor: 'rgba(59, 130, 246, 0.04)',
                border: '1px solid rgba(59, 130, 246, 0.15)',
                marginBottom: '16px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {selectedBackup.name || 'FoxTrade Backup'}
                    </span>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted, #6b7280)', marginLeft: '8px' }}>
                      v{selectedBackupData?.version || '3.0'}
                    </span>
                  </div>

                  <div style={{
                    padding: '3px 8px',
                    borderRadius: '9999px',
                    backgroundColor: '#3b82f6',
                    color: '#ffffff',
                    fontSize: '10px',
                    fontWeight: 700
                  }}>
                    {loadingDetails ? 'Analyzing...' : `${backupTradeCount} Trades`}
                  </div>
                </div>

                {/* Metrics Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', paddingTop: '6px', borderTop: '1px solid rgba(59, 130, 246, 0.1)' }}>
                  <div>
                    <div style={{ fontSize: '9px', color: 'var(--text-muted, #6b7280)', textTransform: 'uppercase', fontWeight: 600 }}>Realized P&L</div>
                    <div style={{ 
                      fontSize: '12px', 
                      fontWeight: 700, 
                      color: backupNetPnl >= 0 ? '#10b981' : '#ef4444', 
                      marginTop: '1px' 
                    }}>
                      {backupNetPnl >= 0 ? `+₹${backupNetPnl.toLocaleString('en-IN')}` : `-₹${Math.abs(backupNetPnl).toLocaleString('en-IN')}`}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '9px', color: 'var(--text-muted, #6b7280)', textTransform: 'uppercase', fontWeight: 600 }}>Win Rate</div>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '1px' }}>
                      {backupWinRate}%
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '9px', color: 'var(--text-muted, #6b7280)', textTransform: 'uppercase', fontWeight: 600 }}>Diff vs Local</div>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: newTradesIncoming > 0 ? '#3b82f6' : 'var(--text-muted)', marginTop: '1px' }}>
                      {newTradesIncoming > 0 ? `+${newTradesIncoming} New Trades` : 'Identical'}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 5-Category Restore Selectors (Custom Minimalist Dropdowns) */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
              
              {/* 1. Journal Entries */}
              <MinimalDropdown
                label="Journal Entries"
                value={journalStrategy}
                onChange={setJournalStrategy}
                options={[
                  { value: 'merge', label: 'Merge & Keep (Recommended)' },
                  { value: 'overwrite', label: 'Overwrite All' },
                  { value: 'skip', label: 'Do Not Restore' }
                ]}
                description="Reconciles cloud trades with local timestamps"
              />

              {/* 2. Monthly Performance */}
              <MinimalDropdown
                label="Monthly Performance"
                value={monthlyStrategy}
                onChange={setMonthlyStrategy}
                options={[
                  { value: 'overwrite', label: 'Overwrite All' },
                  { value: 'merge', label: 'Merge & Keep' },
                  { value: 'skip', label: 'Do Not Restore' }
                ]}
                description="Monthly P&L, ROI %, and capital snapshots"
              />

              {/* 3. Tax Analytics Data */}
              <MinimalDropdown
                label="Tax Analytics Data"
                value={taxStrategy}
                onChange={setTaxStrategy}
                options={[
                  { value: 'overwrite', label: 'Overwrite All' },
                  { value: 'merge', label: 'Merge & Keep' },
                  { value: 'skip', label: 'Do Not Restore' }
                ]}
                description="Financial year tax calculations & turnover metrics"
              />

              {/* 4. Notes & Playbook */}
              <MinimalDropdown
                label="Notes & Playbook"
                value={notesStrategy}
                onChange={setNotesStrategy}
                options={[
                  { value: 'merge', label: 'Merge & Keep' },
                  { value: 'overwrite', label: 'Overwrite All' },
                  { value: 'skip', label: 'Do Not Restore' }
                ]}
                description="Rules, setups, psychological notes, and tags"
              />

              {/* 5. App & Column Settings */}
              <MinimalDropdown
                label="App & Column Settings"
                value={appSettingsStrategy}
                onChange={setAppSettingsStrategy}
                options={[
                  { value: 'restore', label: 'Restore from Backup' },
                  { value: 'skip', label: 'Keep Current Settings' }
                ]}
                description="Visible column preferences and custom ordering"
              />
            </div>

            {/* Divider */}
            <div style={{ height: '1px', backgroundColor: 'var(--border-color, #e5e7eb)', margin: '4px 0 14px 0' }} />

            {/* Feature Toggles */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              
              {/* Chart Images Toggle */}
              <div style={{
                padding: '9px 12px',
                borderRadius: '10px',
                backgroundColor: 'var(--bg-primary, #f9fafb)',
                border: '1px solid var(--border-color, #e5e7eb)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    Chart Images
                  </div>
                  <div style={{ fontSize: '9px', color: 'var(--text-muted, #6b7280)', marginTop: '1px' }}>
                    Restore full resolution chart screenshots and trade attachments.
                  </div>
                </div>

                <label style={{ position: 'relative', display: 'inline-block', width: '32px', height: '18px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={restoreImages}
                    onChange={() => setRestoreImages(!restoreImages)}
                    style={{ opacity: 0, width: 0, height: 0 }}
                  />
                  <span style={{
                    position: 'absolute',
                    top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: restoreImages ? '#3b82f6' : 'var(--border-hover, #4b5563)',
                    borderRadius: '18px',
                    transition: '0.2s'
                  }}>
                    <span style={{
                      position: 'absolute',
                      content: '""',
                      height: '14px', width: '14px',
                      left: restoreImages ? '16px' : '2px',
                      bottom: '2px',
                      backgroundColor: '#ffffff',
                      borderRadius: '50%',
                      transition: '0.2s'
                    }} />
                  </span>
                </label>
              </div>

              {/* Broker API Keys Toggle */}
              <div style={{
                padding: '9px 12px',
                borderRadius: '10px',
                backgroundColor: 'var(--bg-primary, #f9fafb)',
                border: '1px solid var(--border-color, #e5e7eb)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-primary)' }}>
                      Broker API Keys
                    </span>
                    <span style={{
                      fontSize: '8px',
                      fontWeight: 700,
                      padding: '1px 5px',
                      borderRadius: '9999px',
                      backgroundColor: 'rgba(245, 158, 11, 0.15)',
                      border: '1px solid rgba(245, 158, 11, 0.3)',
                      color: '#f59e0b',
                      letterSpacing: '0.04em'
                    }}>
                      ENCRYPTED
                    </span>
                  </div>
                  <div style={{ fontSize: '9px', color: 'var(--text-muted, #6b7280)', marginTop: '1px' }}>
                    Restore encrypted Zerodha, Dhan, Upstox credentials.
                  </div>
                </div>

                <label style={{ position: 'relative', display: 'inline-block', width: '32px', height: '18px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={restoreBrokerKeys}
                    onChange={() => setRestoreBrokerKeys(!restoreBrokerKeys)}
                    style={{ opacity: 0, width: 0, height: 0 }}
                  />
                  <span style={{
                    position: 'absolute',
                    top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: restoreBrokerKeys ? '#3b82f6' : 'var(--border-hover, #4b5563)',
                    borderRadius: '18px',
                    transition: '0.2s'
                  }}>
                    <span style={{
                      position: 'absolute',
                      content: '""',
                      height: '14px', width: '14px',
                      left: restoreBrokerKeys ? '16px' : '2px',
                      bottom: '2px',
                      backgroundColor: '#ffffff',
                      borderRadius: '50%',
                      transition: '0.2s'
                    }} />
                  </span>
                </label>
              </div>

            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div style={{
          padding: '12px 24px',
          borderTop: '1px solid var(--border-color, #e5e7eb)',
          backgroundColor: 'var(--bg-surface, #ffffff)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted, #6b7280)' }}>
            {selectedBackup ? (
              <span>Target: <strong style={{ color: 'var(--text-primary)' }}>{activePortfolioName}</strong> ({journalStrategy === 'merge' ? 'CRDT Merge' : journalStrategy === 'overwrite' ? 'Full Overwrite' : 'Custom'})</span>
            ) : (
              <span>Select a backup source to continue</span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={onClose}
              disabled={isRestoring}
              style={{
                padding: '7px 15px',
                borderRadius: '8px',
                border: '1px solid var(--border-color, #e5e7eb)',
                backgroundColor: 'transparent',
                fontSize: '12px',
                fontWeight: 600,
                color: 'var(--text-primary, #111827)',
                cursor: 'pointer',
                transition: 'background-color 0.15s ease'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              Cancel
            </button>

            <button
              onClick={handleRestoreSubmit}
              disabled={!selectedBackup || isRestoring}
              style={{
                padding: '7px 18px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: (!selectedBackup || isRestoring) ? 'var(--border-color, #9ca3af)' : '#3b82f6',
                color: '#ffffff',
                fontSize: '12px',
                fontWeight: 700,
                cursor: (!selectedBackup || isRestoring) ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '7px',
                boxShadow: (!selectedBackup || isRestoring) ? 'none' : '0 2px 8px rgba(59, 130, 246, 0.3)',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => {
                if (selectedBackup && !isRestoring) e.currentTarget.style.backgroundColor = '#2563eb';
              }}
              onMouseLeave={(e) => {
                if (selectedBackup && !isRestoring) e.currentTarget.style.backgroundColor = '#3b82f6';
              }}
            >
              <History size={13} className={isRestoring ? 'animate-spin' : ''} />
              <span>{isRestoring ? 'Restoring Data...' : 'Restore Backup'}</span>
            </button>
          </div>
        </div>

      </div>
    </div>,
    document.body
  );
}
