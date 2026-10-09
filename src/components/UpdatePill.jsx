import React, { useState, useEffect, useRef } from 'react';
import { ArrowUpCircle, RefreshCw, Sparkles, Check, AlertCircle } from 'lucide-react';

export default function UpdatePill({ onOpenDialog }) {
  const isElectron = typeof window !== 'undefined' && Boolean(window.updater || window.electronAPI?.updater);
  const [updateState, setUpdateState] = useState({
    status: 'idle',
    version: null,
    progress: 0,
    isDismissed: false
  });
  const hasToastedRef = useRef(false);

  useEffect(() => {
    if (!isElectron) return;

    const updater = window.updater || window.electronAPI?.updater;
    if (!updater) return;

    // Fetch initial state
    if (updater.getState) {
      updater.getState().then(st => {
        if (st) setUpdateState(st);
      }).catch(() => {});
    }

    const unsub = updater.onState?.((state) => {
      if (!state) return;
      setUpdateState(state);

      // Trigger one-time toast on download complete
      if (state.status === 'downloaded' && !hasToastedRef.current) {
        hasToastedRef.current = true;
        try {
          window.dispatchEvent(new CustomEvent('foxtrade_toast', {
            detail: {
              id: Date.now(),
              type: 'success',
              title: 'FoxTrade Update Ready',
              description: `Version ${state.version || ''} downloaded. Restart to update.`
            }
          }));
        } catch (_) {}
      }
    });

    return () => {
      if (typeof unsub === 'function') unsub();
    };
  }, [isElectron]);

  if (!isElectron) return null; // Zero footprint on web

  const { status, progress, version, isDismissed } = updateState;

  // Hidden when idle, checking, in dev-mode, or dismissed
  if (status === 'idle' || status === 'checking' || status === 'dev-mode') {
    return null;
  }

  const handleRetry = (e) => {
    e.stopPropagation();
    const updater = window.updater || window.electronAPI?.updater;
    updater?.check?.();
  };

  // 1. Available or Downloading
  if (status === 'available' || status === 'downloading') {
    return (
      <button
        type="button"
        onClick={onOpenDialog}
        title={`Downloading FoxTrade update (${progress}%)... Click to view details.`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '7px',
          height: '24px',
          padding: '0 10px',
          borderRadius: '12px',
          fontSize: '11px',
          fontWeight: 600,
          backgroundColor: 'var(--bg-surface, rgba(59, 130, 246, 0.08))',
          color: 'var(--text-primary, #2563eb)',
          border: '1px solid rgba(59, 130, 246, 0.25)',
          cursor: 'pointer',
          userSelect: 'none',
          transition: 'all 0.15s ease',
          WebkitAppRegion: 'no-drag'
        }}
      >
        <RefreshCw size={12} className="animate-spin text-blue-500" />
        <span>Updating... {progress}%</span>
        {/* Thin progress track */}
        <div style={{
          width: '32px',
          height: '3px',
          backgroundColor: 'rgba(59, 130, 246, 0.2)',
          borderRadius: '2px',
          overflow: 'hidden'
        }}>
          <div style={{
            width: `${progress}%`,
            height: '100%',
            backgroundColor: '#2563eb',
            transition: 'width 0.2s ease'
          }} />
        </div>
      </button>
    );
  }

  // 2. Downloaded and Ready to install
  if (status === 'downloaded' && !isDismissed) {
    return (
      <button
        type="button"
        onClick={onOpenDialog}
        title={`Version ${version || ''} is ready. Click to restart and update.`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          height: '24px',
          padding: '0 10px',
          borderRadius: '12px',
          fontSize: '11px',
          fontWeight: 600,
          backgroundColor: '#10b981',
          color: '#ffffff',
          border: '1px solid rgba(16, 185, 129, 0.5)',
          cursor: 'pointer',
          boxShadow: '0 2px 8px rgba(16, 185, 129, 0.25)',
          userSelect: 'none',
          animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
          transition: 'transform 0.15s ease',
          WebkitAppRegion: 'no-drag'
        }}
        onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.02)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
      >
        <ArrowUpCircle size={13} strokeWidth={2.2} />
        <span>Restart to update {version ? `v${version}` : ''}</span>
      </button>
    );
  }

  // 3. Error state (neutral, small, non-scary)
  if (status === 'error') {
    return (
      <button
        type="button"
        onClick={handleRetry}
        title="Update check could not complete. Click to retry."
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '5px',
          height: '22px',
          padding: '0 8px',
          borderRadius: '11px',
          fontSize: '11px',
          fontWeight: 500,
          backgroundColor: 'transparent',
          color: 'var(--text-secondary, #6b7280)',
          border: '1px solid var(--border-color, #e5e7eb)',
          cursor: 'pointer',
          userSelect: 'none',
          WebkitAppRegion: 'no-drag'
        }}
      >
        <AlertCircle size={11} />
        <span>Update failed · Retry</span>
      </button>
    );
  }

  return null;
}
