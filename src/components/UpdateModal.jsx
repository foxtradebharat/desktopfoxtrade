import React, { useState, useEffect } from 'react';
import { RefreshCw, Download, CheckCircle2, AlertCircle, Sparkles, X, ShieldCheck, ArrowRight, RotateCcw } from 'lucide-react';

export default function UpdateModal({ isOpen, onClose }) {
  const [state, setState] = useState({
    status: 'checking',
    version: null,
    releaseNotes: '',
    releaseName: '',
    progress: 0,
    speed: 0,
    transferred: 0,
    total: 0,
    error: null
  });
  const [currentVersion, setCurrentVersion] = useState('1.0.0');

  useEffect(() => {
    if (!isOpen) return;

    const updater = window.updater || window.electronAPI?.updater;
    if (!updater) {
      setState(prev => ({ ...prev, status: 'not-available' }));
      return;
    }

    // Get current installed version
    updater.getVersion?.().then(ver => {
      if (ver) setCurrentVersion(ver);
    }).catch(() => {});

    // Get current state
    if (updater.getState) {
      updater.getState().then(st => {
        if (st) {
          setState({
            status: st.status || 'checking',
            version: st.version,
            releaseNotes: st.releaseNotes || '',
            releaseName: st.releaseName || '',
            progress: st.progress || 0,
            speed: st.speed || 0,
            transferred: st.transferred || 0,
            total: st.total || 0,
            error: st.error
          });
        }
      }).catch(() => {});
    }

    // Trigger update check if idle or error
    updater.check?.().catch(() => {});

    const unsub = updater.onState?.((newState) => {
      if (!newState) return;
      setState({
        status: newState.status,
        version: newState.version,
        releaseNotes: newState.releaseNotes || '',
        releaseName: newState.releaseName || '',
        progress: newState.progress || 0,
        speed: newState.speed || 0,
        transferred: newState.transferred || 0,
        total: newState.total || 0,
        error: newState.error
      });
    });

    return () => {
      if (typeof unsub === 'function') unsub();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const updater = window.updater || window.electronAPI?.updater;

  const handleRestartNow = () => {
    updater?.install?.();
  };

  const handleRemindLater = () => {
    updater?.dismiss?.();
    onClose();
  };

  const handleSkipVersion = () => {
    if (state.version && updater?.skipVersion) {
      updater.skipVersion(state.version);
    }
    onClose();
  };

  const handleRetryCheck = () => {
    setState(prev => ({ ...prev, status: 'checking', error: null }));
    updater?.check?.();
  };

  const formatSpeed = (bytesPerSec) => {
    if (!bytesPerSec) return '';
    if (bytesPerSec > 1024 * 1024) return `${(bytesPerSec / (1024 * 1024)).toFixed(1)} MB/s`;
    return `${(bytesPerSec / 1024).toFixed(0)} KB/s`;
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 99999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0, 0, 0, 0.65)',
      backdropFilter: 'blur(4px)',
      padding: '16px'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '480px',
        backgroundColor: 'var(--bg-surface, #ffffff)',
        color: 'var(--text-primary, #111827)',
        borderRadius: '16px',
        border: '1px solid var(--border-color, #e5e7eb)',
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.25)',
        overflow: 'hidden',
        animation: 'fadeIn 0.2s ease-out'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-color, #e5e7eb)',
          backgroundColor: 'var(--bg-primary, #f9fafb)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '28px',
              height: '28px',
              borderRadius: '8px',
              backgroundColor: '#2563eb',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff'
            }}>
              <Sparkles size={16} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, letterSpacing: '-0.2px' }}>
                FoxTrade Update
              </h3>
              <span style={{ fontSize: '11px', color: 'var(--text-secondary, #6b7280)' }}>
                Current Version: v{currentVersion}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary, #9ca3af)',
              cursor: 'pointer',
              padding: '4px',
              borderRadius: '6px'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div style={{ padding: '20px' }}>
          {/* Status: Checking */}
          {state.status === 'checking' && (
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <RefreshCw size={32} className="animate-spin text-blue-500 mx-auto" />
              <p style={{ marginTop: '14px', fontSize: '14px', fontWeight: 600 }}>
                Checking for FoxTrade updates…
              </p>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary, #6b7280)', margin: '4px 0 0 0' }}>
                Connecting to GitHub Releases
              </p>
            </div>
          )}

          {/* Status: Idle or Up-to-date */}
          {(state.status === 'idle' || state.status === 'not-available') && (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{
                width: '44px',
                height: '44px',
                borderRadius: '50%',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                color: '#10b981',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 12px auto'
              }}>
                <CheckCircle2 size={24} />
              </div>
              <h4 style={{ margin: '0 0 6px 0', fontSize: '16px', fontWeight: 700 }}>
                You're on the latest version!
              </h4>
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary, #6b7280)', lineHeight: 1.5 }}>
                FoxTrade v{currentVersion} is up to date with the newest features, bug fixes, and analytics optimizations.
              </p>
            </div>
          )}

          {/* Status: Downloading or Available */}
          {(state.status === 'downloading' || state.status === 'available') && (
            <div>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 10px',
                borderRadius: '9999px',
                backgroundColor: 'rgba(37, 99, 235, 0.1)',
                color: '#2563eb',
                fontSize: '12px',
                fontWeight: 600,
                marginBottom: '12px'
              }}>
                <span>New Version Available: v{state.version}</span>
              </div>

              <h4 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: 700 }}>
                Downloading FoxTrade v{state.version}…
              </h4>

              {/* Progress bar */}
              <div style={{
                width: '100%',
                height: '8px',
                backgroundColor: 'var(--bg-primary, #e5e7eb)',
                borderRadius: '4px',
                overflow: 'hidden',
                margin: '14px 0 6px 0'
              }}>
                <div style={{
                  width: `${state.progress}%`,
                  height: '100%',
                  backgroundColor: '#2563eb',
                  transition: 'width 0.2s ease'
                }} />
              </div>

              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '11px',
                color: 'var(--text-secondary, #6b7280)'
              }}>
                <span>{state.progress}% completed</span>
                <span>{formatSpeed(state.speed)}</span>
              </div>
            </div>
          )}

          {/* Status: Downloaded & Ready to install */}
          {state.status === 'downloaded' && (
            <div>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 10px',
                borderRadius: '9999px',
                backgroundColor: 'rgba(16, 185, 129, 0.12)',
                color: '#059669',
                fontSize: '12px',
                fontWeight: 700,
                marginBottom: '10px'
              }}>
                <CheckCircle2 size={14} />
                <span>Update Ready: v{state.version}</span>
              </div>

              <h4 style={{ margin: '0 0 6px 0', fontSize: '17px', fontWeight: 700 }}>
                {state.releaseName || `FoxTrade v${state.version}`}
              </h4>

              {/* What's New Release Notes */}
              {state.releaseNotes ? (
                <div style={{
                  margin: '12px 0',
                  maxHeight: '140px',
                  overflowY: 'auto',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  backgroundColor: 'var(--bg-primary, #f9fafb)',
                  border: '1px solid var(--border-color, #e5e7eb)',
                  fontSize: '12.5px',
                  lineHeight: 1.5,
                  color: 'var(--text-primary, #374151)',
                  whiteSpace: 'pre-wrap'
                }}>
                  <div style={{ fontWeight: 700, fontSize: '11.5px', color: 'var(--text-secondary, #6b7280)', marginBottom: '4px', textTransform: 'uppercase' }}>
                    What's New:
                  </div>
                  {state.releaseNotes}
                </div>
              ) : null}
            </div>
          )}

          {/* Status: Error */}
          {state.status === 'error' && (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                color: '#ef4444',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 10px auto'
              }}>
                <AlertCircle size={22} />
              </div>
              <h4 style={{ margin: '0 0 4px 0', fontSize: '15px', fontWeight: 700 }}>
                Update Check Notice
              </h4>
              <p style={{ margin: 0, fontSize: '12.5px', color: 'var(--text-secondary, #6b7280)', lineHeight: 1.4 }}>
                {state.error || 'Unable to connect to the update server. Please check your internet connection and try again.'}
              </p>
            </div>
          )}

          {/* Status: Dev Mode */}
          {state.status === 'dev-mode' && (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <span style={{
                display: 'inline-block',
                padding: '4px 10px',
                borderRadius: '9999px',
                backgroundColor: 'rgba(107, 114, 128, 0.1)',
                color: '#6b7280',
                fontSize: '12px',
                fontWeight: 600,
                marginBottom: '8px'
              }}>
                Local Development Build
              </span>
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary, #6b7280)' }}>
                Auto-updater is active in packaged releases. (Current build: v{currentVersion})
              </p>
            </div>
          )}

          {/* Reassurance banner: Your data is safe */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginTop: '16px',
            padding: '10px 12px',
            borderRadius: '8px',
            backgroundColor: 'rgba(16, 185, 129, 0.08)',
            border: '1px solid rgba(16, 185, 129, 0.2)',
            fontSize: '11.5px',
            color: 'var(--text-primary, #111827)'
          }}>
            <ShieldCheck size={16} color="#10b981" style={{ flexShrink: 0 }} />
            <span>
              <strong>Data Safe:</strong> Your trades, local database, and Google login sessions are automatically backed up and preserved across updates.
            </span>
          </div>
        </div>

        {/* Footer Actions */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 20px',
          borderTop: '1px solid var(--border-color, #e5e7eb)',
          backgroundColor: 'var(--bg-primary, #f9fafb)'
        }}>
          {state.status === 'downloaded' ? (
            <>
              <button
                type="button"
                onClick={handleSkipVersion}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '11.5px',
                  color: 'var(--text-secondary, #9ca3af)',
                  cursor: 'pointer',
                  padding: 0
                }}
              >
                Skip this version
              </button>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={handleRemindLater}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '8px',
                    fontSize: '12.5px',
                    fontWeight: 600,
                    border: '1px solid var(--border-color, #d1d5db)',
                    backgroundColor: 'transparent',
                    color: 'var(--text-primary, #374151)',
                    cursor: 'pointer'
                  }}
                >
                  Later
                </button>
                <button
                  type="button"
                  onClick={handleRestartNow}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    fontSize: '12.5px',
                    fontWeight: 700,
                    border: 'none',
                    backgroundColor: '#10b981',
                    color: '#ffffff',
                    cursor: 'pointer',
                    boxShadow: '0 2px 6px rgba(16, 185, 129, 0.3)'
                  }}
                >
                  Restart Now
                </button>
              </div>
            </>
          ) : state.status === 'error' ? (
            <>
              <div />
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={onClose}
                  style={{
                    padding: '7px 14px',
                    borderRadius: '8px',
                    fontSize: '12.5px',
                    fontWeight: 600,
                    border: '1px solid var(--border-color, #d1d5db)',
                    backgroundColor: 'transparent',
                    color: 'var(--text-primary, #374151)',
                    cursor: 'pointer'
                  }}
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={handleRetryCheck}
                  style={{
                    padding: '7px 14px',
                    borderRadius: '8px',
                    fontSize: '12.5px',
                    fontWeight: 600,
                    border: 'none',
                    backgroundColor: '#2563eb',
                    color: '#ffffff',
                    cursor: 'pointer'
                  }}
                >
                  Retry Check
                </button>
              </div>
            </>
          ) : (
            <>
              <div />
              <button
                type="button"
                onClick={onClose}
                style={{
                  padding: '7px 16px',
                  borderRadius: '8px',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  border: '1px solid var(--border-color, #d1d5db)',
                  backgroundColor: 'transparent',
                  color: 'var(--text-primary, #374151)',
                  cursor: 'pointer'
                }}
              >
                Close
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
