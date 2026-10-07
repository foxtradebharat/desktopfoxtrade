import React from 'react';
import { AlertTriangle, RefreshCw, ArrowLeft, Copy, Check } from 'lucide-react';

export default class PageErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      copied: false
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[FoxTrade PageErrorBoundary caught an error]:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  handleCopyDetails = () => {
    const errorText = `FoxTrade Module Crash Report
Module: ${this.props.moduleName || 'Page'}
Time: ${new Date().toISOString()}
Error: ${this.state.error?.name || 'Error'}: ${this.state.error?.message || 'Unknown error'}
Stack:
${this.state.error?.stack || 'No stack'}
ComponentStack:
${this.state.errorInfo?.componentStack || 'No component stack'}`;

    if (navigator.clipboard) {
      navigator.clipboard.writeText(errorText).then(() => {
        this.setState({ copied: true });
        setTimeout(() => this.setState({ copied: false }), 2000);
      }).catch(() => {});
    }
  };

  render() {
    if (this.state.hasError) {
      const moduleName = this.props.moduleName || 'This section';

      return (
        <div style={{
          minHeight: '450px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '32px 16px'
        }}>
          <div style={{
            maxWidth: '620px',
            width: '100%',
            backgroundColor: 'var(--bg-surface, #0f172a)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '16px',
            padding: '28px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)'
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', marginBottom: '20px' }}>
              <div style={{
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ef4444',
                flexShrink: 0
              }}>
                <AlertTriangle size={24} />
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{
                  fontSize: '18px',
                  fontWeight: 600,
                  color: 'var(--text-primary, #f8fafc)',
                  margin: '0 0 6px 0'
                }}>
                  {moduleName} encountered an unexpected issue
                </h3>
                <p style={{
                  fontSize: '13.5px',
                  color: 'var(--text-muted, #94a3b8)',
                  margin: 0,
                  lineHeight: '1.5'
                }}>
                  FoxTrade isolated this error to protect your trading journal data and active portfolio state. Your trade records are completely safe.
                </p>
              </div>
            </div>

            <div style={{
              backgroundColor: 'rgba(0, 0, 0, 0.3)',
              borderRadius: '8px',
              padding: '12px 14px',
              marginBottom: '20px',
              border: '1px solid rgba(255, 255, 255, 0.05)',
              fontFamily: 'monospace',
              fontSize: '12px',
              color: '#f87171',
              wordBreak: 'break-word'
            }}>
              {this.state.error?.message || 'Unknown runtime error'}
            </div>

            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
              <button
                onClick={this.handleReset}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  backgroundColor: '#3b82f6',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '9px 16px',
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'background-color 0.15s ease'
                }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = '#2563eb'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = '#3b82f6'}
              >
                <RefreshCw size={15} />
                Try Again
              </button>

              {this.props.onNavigateToJournal && (
                <button
                  onClick={this.props.onNavigateToJournal}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    backgroundColor: 'rgba(255, 255, 255, 0.06)',
                    color: 'var(--text-primary, #f8fafc)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: '8px',
                    padding: '9px 16px',
                    fontSize: '13px',
                    fontWeight: 500,
                    cursor: 'pointer'
                  }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.06)'}
                >
                  <ArrowLeft size={15} />
                  Return to Journal
                </button>
              )}

              <button
                onClick={this.handleCopyDetails}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: 'transparent',
                  color: 'var(--text-muted, #94a3b8)',
                  border: 'none',
                  padding: '9px 12px',
                  fontSize: '12.5px',
                  cursor: 'pointer',
                  marginLeft: 'auto'
                }}
                onMouseEnter={e => e.currentTarget.style.color = '#f8fafc'}
                onMouseLeave={e => e.currentTarget.style.color = '#94a3b8'}
              >
                {this.state.copied ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                {this.state.copied ? 'Copied Details' : 'Copy Diagnostics'}
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
