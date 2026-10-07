import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  Upload, 
  History, 
  Sliders, 
  Unlink, 
  CheckCircle2, 
  RefreshCw,
  CloudOff,
  AlertCircle
} from 'lucide-react';
import { subscribeToSyncStatus } from '../db/index.js';
import { subscribeToDriveStatus } from '../services/driveClient.js';

function getRelativeTimeString(timestampMs) {
  if (!timestampMs) return 'recently';
  const elapsedSec = Math.floor((Date.now() - timestampMs) / 1000);
  if (elapsedSec < 15) return 'just now';
  if (elapsedSec < 60) return `${elapsedSec}s ago`;
  const mins = Math.floor(elapsedSec / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  return `${hrs}h ${remMins}m ago`;
}

export default function CloudSyncPopover({ 
  isOpen, 
  onClose, 
  onLogout, 
  initialSyncTs,
  autoBackup,
  setAutoBackup,
  onBackupNow,
  onOpenRestoreModal,
  isConnected = false,
  isSyncing: propIsSyncing,
  syncError = null,
  onShowToast,
  onReconnectDrive
}) {
  const [internalSyncing, setInternalSyncing] = useState(false);
  const isSyncing = propIsSyncing !== undefined ? propIsSyncing : internalSyncing;
  const [lastSyncTs, setLastSyncTs] = useState(initialSyncTs || (Date.now() - 15 * 60 * 1000));
  const [relativeText, setRelativeText] = useState(() => getRelativeTimeString(lastSyncTs));

  const [driveStatus, setDriveStatusLocal] = useState('connected');

  useEffect(() => {
    const unsub = subscribeToDriveStatus((st) => setDriveStatusLocal(st));
    return unsub;
  }, []);

  const isAuthError = Boolean(
    driveStatus === 'needs_reconnect' ||
    (syncError && (
      syncError.toLowerCase().includes('expired') ||
      syncError.toLowerCase().includes('authentication') ||
      syncError.toLowerCase().includes('oauth') ||
      syncError.toLowerCase().includes('401') ||
      syncError.toLowerCase().includes('token') ||
      syncError.toLowerCase().includes('revoked')
    ))
  );

  // Subscribe to real background sync events from syncEngine
  useEffect(() => {
    const unsub = subscribeToSyncStatus((syncing) => {
      setInternalSyncing(syncing);
      if (!syncing) {
        setLastSyncTs(Date.now());
        setRelativeText('just now');
      }
    });
    return unsub;
  }, []);

  // Timer for relative time update
  useEffect(() => {
    const updateTime = () => {
      setRelativeText(getRelativeTimeString(lastSyncTs));
    };
    updateTime();
    const interval = setInterval(updateTime, 15_000);
    return () => clearInterval(interval);
  }, [lastSyncTs]);

  if (!isOpen) return null;

  const handleBackupClick = async () => {
    if (isSyncing) return;
    if (isAuthError && onReconnectDrive) {
      await onReconnectDrive();
      return;
    }
    try {
      if (onBackupNow) {
        await onBackupNow();
      }
      setLastSyncTs(Date.now());
      setRelativeText('just now');
    } catch (err) {
      console.warn('[CloudSyncPopover] Manual backup error:', err);
    }
  };

  return createPortal(
    <>
      {/* Backdrop overlay */}
      <div 
        onClick={onClose}
        style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          zIndex: 1100
        }}
      />

      {/* Popover Card */}
      <div style={{
        position: 'fixed',
        bottom: '68px',
        right: '16px',
        width: '272px',
        backgroundColor: 'var(--bg-surface, #ffffff)',
        borderRadius: '14px',
        boxShadow: '0 12px 32px -4px rgba(0, 0, 0, 0.15), 0 4px 12px -2px rgba(0, 0, 0, 0.08)',
        border: '1px solid var(--border-color, #e5e7eb)',
        padding: '6px',
        zIndex: 1200,
        fontFamily: "'Inter', sans-serif",
        color: 'var(--text-primary, #111827)'
      }}>
        {/* Status Header */}
        <div style={{
          padding: '10px 12px',
          borderBottom: '1px solid var(--border-color, #f3f4f6)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <div style={{
            width: '28px',
            height: '28px',
            borderRadius: '50%',
            backgroundColor: syncError
              ? 'rgba(239, 68, 68, 0.1)'
              : isSyncing 
                ? 'rgba(59, 130, 246, 0.1)' 
                : isConnected 
                  ? 'rgba(16, 185, 129, 0.1)' 
                  : 'rgba(156, 163, 175, 0.1)',
            border: `1px solid ${
              syncError
                ? 'rgba(239, 68, 68, 0.3)'
                : isSyncing 
                  ? 'rgba(59, 130, 246, 0.2)' 
                  : isConnected 
                    ? 'rgba(16, 185, 129, 0.2)' 
                    : 'rgba(156, 163, 175, 0.2)'
            }`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            {syncError ? (
              isAuthError ? <RefreshCw size={13} color="#ef4444" /> : <AlertCircle size={14} color="#ef4444" />
            ) : isSyncing ? (
              <RefreshCw size={13} className="animate-spin" color="#3b82f6" />
            ) : isConnected ? (
              <CheckCircle2 size={14} color="#10b981" />
            ) : (
              <CloudOff size={14} color="#9ca3af" />
            )}
          </div>
          
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ 
              fontSize: '12px', 
              fontWeight: 600, 
              color: syncError ? '#ef4444' : 'var(--text-primary)', 
              whiteSpace: 'nowrap', 
              overflow: 'hidden', 
              textOverflow: 'ellipsis' 
            }}>
              {syncError 
                ? (isAuthError ? 'Drive Session Expired' : 'Drive Backup Error') 
                : isSyncing 
                  ? 'Syncing to Drive...' 
                  : isConnected 
                    ? 'Cloud Sync Active' 
                    : 'Drive Disconnected'}
            </div>
            <div 
              style={{ 
                fontSize: '10px', 
                color: syncError ? '#dc2626' : 'var(--text-muted, #6b7280)', 
                marginTop: '1px',
                lineHeight: '1.35',
                wordBreak: 'break-word',
                whiteSpace: 'normal'
              }}
              title={syncError || ''}
            >
              {syncError 
                ? (isAuthError ? 'Your Google Drive token expired. Click Reconnect to resume backups.' : syncError)
                : isSyncing 
                  ? 'Saving changes...' 
                  : isConnected 
                    ? `Last synced ${relativeText}` 
                    : 'Google Drive disconnected'}
            </div>
          </div>
        </div>

        {/* Action List */}
        <div style={{ padding: '4px 0', display: 'flex', flexDirection: 'column', gap: '2px' }}>
          
          {/* Reconnect Google Drive if auth session expired */}
          {isAuthError && (
            <button
              type="button"
              onClick={async () => {
                if (onReconnectDrive) {
                  await onReconnectDrive();
                }
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                width: '100%',
                padding: '8px 10px',
                borderRadius: '8px',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                backgroundColor: 'rgba(239, 68, 68, 0.07)',
                fontSize: '12px',
                fontWeight: 600,
                color: '#ef4444',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'background-color 0.15s ease',
                marginBottom: '2px'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.14)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.07)'; }}
            >
              <RefreshCw size={13} color="#ef4444" />
              <span style={{ flex: 1 }}>Reconnect Google Drive</span>
            </button>
          )}

          {/* Backup Now */}
          <button
            onClick={handleBackupClick}
            disabled={isSyncing}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              width: '100%',
              padding: '8px 10px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: 'transparent',
              fontSize: '12px',
              fontWeight: 500,
              color: 'var(--text-primary)',
              cursor: isSyncing ? 'not-allowed' : 'pointer',
              textAlign: 'left',
              transition: 'background-color 0.15s ease'
            }}
            onMouseEnter={(e) => { if (!isSyncing) e.currentTarget.style.backgroundColor = 'var(--bg-hover)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
          >
            <Upload size={14} color={isSyncing ? '#3b82f6' : 'var(--text-muted, #6b7280)'} className={isSyncing ? 'animate-bounce' : ''} />
            <span style={{ flex: 1 }}>{isSyncing ? 'Backing Up...' : 'Backup Now'}</span>
          </button>

          {/* Backup & Restore History */}
          <button
            onClick={() => {
              onClose();
              if (onOpenRestoreModal) onOpenRestoreModal();
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              width: '100%',
              padding: '8px 10px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: 'transparent',
              fontSize: '12px',
              fontWeight: 500,
              color: 'var(--text-primary)',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'background-color 0.15s ease'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-hover)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <History size={14} color="var(--text-muted, #6b7280)" />
            <span style={{ flex: 1 }}>Backup & Restore History</span>
          </button>

          {/* Auto Backup Toggle */}
          <div 
            onClick={() => setAutoBackup(!autoBackup)}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              padding: '8px 10px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 500,
              color: 'var(--text-primary)',
              transition: 'background-color 0.15s ease'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-hover, rgba(0,0,0,0.04))'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Sliders size={14} color="var(--text-muted, #6b7280)" />
              <span>Auto Backup</span>
            </div>

            <label 
              style={{ position: 'relative', display: 'inline-block', width: '30px', height: '16px', cursor: 'pointer' }}
              onClick={(e) => e.stopPropagation()}
            >
              <input
                type="checkbox"
                checked={autoBackup}
                onChange={() => setAutoBackup(!autoBackup)}
                style={{ opacity: 0, width: 0, height: 0 }}
              />
              <span style={{
                position: 'absolute',
                top: 0, left: 0, right: 0, bottom: 0,
                backgroundColor: autoBackup ? '#2563eb' : '#d1d5db',
                borderRadius: '16px',
                transition: '0.2s ease'
              }}>
                <span style={{
                  position: 'absolute',
                  content: '""',
                  height: '12px', width: '12px',
                  left: autoBackup ? '15px' : '2px',
                  bottom: '2px',
                  backgroundColor: '#ffffff',
                  borderRadius: '50%',
                  transition: '0.2s ease'
                }} />
              </span>
            </label>
          </div>

          <div style={{ height: '1px', backgroundColor: 'var(--border-color, #f3f4f6)', margin: '3px 0' }} />

          {/* Logout / Disconnect Drive */}
          <button
            onClick={() => {
              onClose();
              if (onLogout) onLogout();
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              width: '100%',
              padding: '8px 10px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: 'transparent',
              fontSize: '12px',
              fontWeight: 500,
              color: 'var(--text-muted, #6b7280)',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#fef2f2';
              e.currentTarget.style.color = '#ef4444';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = 'var(--text-muted, #6b7280)';
            }}
          >
            <Unlink size={14} color="currentColor" />
            <span style={{ flex: 1 }}>Disconnect Google Drive</span>
          </button>
        </div>
      </div>
    </>,
    document.body
  );
}
