import React, { useState, useEffect } from 'react';
import {
  X,
  Zap,
  CheckCircle2,
  AlertCircle,
  Clock,
  Trash2,
  RefreshCw,
  Plus,
  ExternalLink,
  ShieldCheck,
  ChevronRight,
  FolderOpen,
  ArrowLeft,
  Key,
  Layers
} from 'lucide-react';
import BrokerLogo from './BrokerLogo';
import { BROKER_LOGOS } from '../services/brokerLogos';
import {
  getConnectedBrokerAccounts,
  saveBrokerAccount,
  removeBrokerAccount,
  checkAccountHealth,
  syncBrokerAccount,
  syncAllActiveBrokerAccounts
} from '../services/brokerApiService';

const BROKER_LIST = [
  { id: 'zerodha', name: 'Zerodha Kite', desc: 'Kite Connect v3 API', color: '#e44b36', supportsApi: true },
  { id: 'dhan', name: 'Dhan HQ', desc: 'Permanent / 30-day API', color: '#059669', supportsApi: true },
  { id: 'upstox', name: 'Upstox v2', desc: 'OAuth 2.0 API', color: '#7c3aed', supportsApi: true },
  { id: 'fyers', name: 'FYERS v3', desc: 'REST Tradebook API', color: '#0ea5e9', supportsApi: true },
  { id: 'angelone', name: 'Angel One', desc: 'SmartAPI Trading', color: '#ef4444', supportsApi: true },
  { id: 'groww', name: 'Groww', desc: 'Auto Tradebook Sync', color: '#00b386', supportsApi: false, note: 'Coming Soon via Open API' },
  { id: 'mstock', name: 'mStock', desc: 'Mirae Asset Direct', color: '#1e3a8a', supportsApi: false, note: 'Tradebook CSV Supported' },
  { id: 'kotak', name: 'Kotak Neo', desc: 'Kotak Neo Open API', color: '#dc2626', supportsApi: false, note: 'Maintenance / Soon' },
];

export default function BrokerConnectivityModal({
  isOpen,
  onClose,
  activePortfolioId = 'portfolio-default',
  portfolios = [],
  onSyncedTrades,
  onSwitchToImportFile,
  settings = {}
}) {
  const showBrokerStats = settings?.statsInBrokers === true;
  const [accounts, setAccounts] = useState(() => getConnectedBrokerAccounts());
  const [selectedBroker, setSelectedBroker] = useState(null); // null = overview grid, or broker object
  const [isAddingAccount, setIsAddingAccount] = useState(false);
  const [syncingAccountId, setSyncingAccountId] = useState(null);
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);

  // Add Account Form State
  const [formAccountName, setFormAccountName] = useState('');
  const [formClientId, setFormClientId] = useState('');
  const [formApiKey, setFormApiKey] = useState('');
  const [formAccessToken, setFormAccessToken] = useState('');
  const [formPortfolioId, setFormPortfolioId] = useState(activePortfolioId);
  const [formError, setFormError] = useState('');

  // Reload accounts on open or event
  useEffect(() => {
    const handleUpdate = () => setAccounts(getConnectedBrokerAccounts());
    window.addEventListener('foxtrade_broker_accounts_updated', handleUpdate);
    return () => window.removeEventListener('foxtrade_broker_accounts_updated', handleUpdate);
  }, []);

  if (!isOpen) return null;

  const currentPortfolio = portfolios.find(p => p.id === activePortfolioId) || { name: 'My Portfolio' };

  const handleStartAddAccount = (broker) => {
    setSelectedBroker(broker);
    setIsAddingAccount(true);
    setFormAccountName(`${broker.name} Main`);
    setFormClientId('');
    setFormApiKey('');
    setFormAccessToken('');
    setFormPortfolioId(activePortfolioId);
    setFormError('');
    setStatusMessage(null);
  };

  const handleSaveAccount = (e) => {
    e.preventDefault();
    setFormError('');

    if (!formAccessToken.trim()) {
      setFormError('Access Token is required to authenticate with the broker.');
      return;
    }

    try {
      const newAcc = saveBrokerAccount({
        broker: selectedBroker.id,
        accountName: formAccountName.trim() || `${selectedBroker.name} Account`,
        clientId: formClientId.trim(),
        userId: formClientId.trim(),
        apiKey: formApiKey.trim(),
        accessToken: formAccessToken.trim(),
        portfolioId: formPortfolioId
      });

      setAccounts(getConnectedBrokerAccounts());
      setIsAddingAccount(false);
      setStatusMessage({
        type: 'success',
        text: `Account "${newAcc.accountName}" connected successfully!`
      });
    } catch (err) {
      setFormError(err.message || 'Failed to save account.');
    }
  };

  const handleDeleteAccount = (accId) => {
    if (window.confirm('Are you sure you want to disconnect this broker account?')) {
      removeBrokerAccount(accId);
      setAccounts(getConnectedBrokerAccounts());
      setStatusMessage({ type: 'info', text: 'Broker account disconnected.' });
    }
  };

  const handleSyncSingleAccount = async (acc) => {
    setSyncingAccountId(acc.id);
    setStatusMessage(null);
    try {
      const res = await syncBrokerAccount(acc);
      if (onSyncedTrades && res.pairedTrades.length > 0) {
        onSyncedTrades(res.pairedTrades);
      }
      setStatusMessage({
        type: 'success',
        text: `Synced ${res.pairedTrades.length} trades from ${acc.accountName}!`
      });
    } catch (err) {
      console.error('Account Sync Error:', err);
      setStatusMessage({
        type: 'error',
        text: `Sync failed for ${acc.accountName}: ${err.message}`
      });
    } finally {
      setSyncingAccountId(null);
      setAccounts(getConnectedBrokerAccounts());
    }
  };

  const handleSyncAll = async () => {
    setIsSyncingAll(true);
    setStatusMessage(null);
    try {
      const res = await syncAllActiveBrokerAccounts(activePortfolioId);
      if (res.errors.length > 0) {
        setStatusMessage({
          type: 'error',
          text: `Synced ${res.totalSynced} trades. Encountered errors: ${res.errors.map(e => e.error).join(', ')}`
        });
      } else {
        setStatusMessage({
          type: 'success',
          text: `Successfully synced ${res.totalSynced} trades across all active broker accounts!`
        });
      }

      // Collect all paired trades
      const allTrades = res.results.flatMap(r => r.trades);
      if (onSyncedTrades && allTrades.length > 0) {
        onSyncedTrades(allTrades);
      }
    } catch (err) {
      setStatusMessage({
        type: 'error',
        text: `Sync All Failed: ${err.message}`
      });
    } finally {
      setIsSyncingAll(false);
      setAccounts(getConnectedBrokerAccounts());
    }
  };

  // Helper for expiry countdown display
  const formatExpiryNotice = (expiresAt) => {
    if (!expiresAt) return 'Valid session';
    const diffMs = expiresAt - Date.now();
    if (diffMs <= 0) return 'Session Expired';
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    if (days > 1) return `Valid for ${days} days`;
    if (hours > 0) return `Expires in ~${hours} hours`;
    const mins = Math.floor(diffMs / (1000 * 60));
    return `Expires in ~${mins} mins`;
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.65)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '20px'
    }}>
      <div style={{
        backgroundColor: 'var(--bg-card, #ffffff)',
        borderRadius: '20px',
        width: '100%',
        maxWidth: '960px',
        maxHeight: '88vh',
        boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.3)',
        border: '1px solid var(--border-color, #e5e7eb)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        position: 'relative',
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif"
      }}>
        {/* Modal Top Bar */}
        <div style={{
          padding: '24px 28px 18px 28px',
          borderBottom: '1px solid var(--border-color, #e5e7eb)',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          backgroundColor: 'var(--bg-primary, #f9fafb)'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              {selectedBroker && (
                <button
                  onClick={() => { setSelectedBroker(null); setIsAddingAccount(false); }}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '2px 6px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    color: 'var(--text-muted, #6b7280)',
                    fontSize: '12px',
                    fontWeight: 600
                  }}>
                  <ArrowLeft size={14} />
                  <span>Brokers</span>
                </button>
              )}
              <h2 style={{
                margin: 0,
                fontSize: '19px',
                fontWeight: 800,
                color: 'var(--text-primary, #111827)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <span>Broker Connectivity</span>
                {selectedBroker && <span style={{ color: 'var(--text-muted, #9ca3af)', fontWeight: 400 }}>/ {selectedBroker.name}</span>}
              </h2>
            </div>
            <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted, #6b7280)', lineHeight: '1.4' }}>
              All data is stored <strong>strictly locally</strong> on your browser — no cloud database, no third-party exposure. Directly connected via official broker APIs.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {accounts.length > 0 && !selectedBroker && (
              <button
                onClick={handleSyncAll}
                disabled={isSyncingAll}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '7px 14px',
                  borderRadius: '10px',
                  backgroundColor: '#059669',
                  color: '#ffffff',
                  border: 'none',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: isSyncingAll ? 'not-allowed' : 'pointer',
                  boxShadow: '0 2px 4px rgba(5, 150, 105, 0.2)'
                }}>
                <RefreshCw size={13} className={isSyncingAll ? 'animate-spin' : ''} />
                <span>{isSyncingAll ? 'Syncing All...' : 'Sync All Accounts'}</span>
              </button>
            )}

            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-muted, #6b7280)',
                padding: '6px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Global Feedback Alert */}
        {statusMessage && (
          <div style={{
            margin: '12px 28px 0 28px',
            padding: '10px 14px',
            borderRadius: '10px',
            fontSize: '12px',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: statusMessage.type === 'success' ? '#ecfdf5' : statusMessage.type === 'error' ? '#fef2f2' : '#f0f9ff',
            color: statusMessage.type === 'success' ? '#065f46' : statusMessage.type === 'error' ? '#991b1b' : '#0369a1',
            border: `1px solid ${statusMessage.type === 'success' ? '#a7f3d0' : statusMessage.type === 'error' ? '#fecaca' : '#bae6fd'}`
          }}>
            {statusMessage.type === 'success' ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
            <span>{statusMessage.text}</span>
          </div>
        )}

        {/* Modal Main Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
          
          {/* VIEW 1: BROKER GRID OVERVIEW */}
          {!selectedBroker && (
            <div>
              {/* Active Connected Accounts Banner */}
              {accounts.length > 0 && (
                <div style={{ marginBottom: '24px' }}>
                  {showBrokerStats && (
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(3, 1fr)',
                      gap: '10px',
                      marginBottom: '16px',
                      padding: '12px 16px',
                      backgroundColor: 'var(--bg-surface, #ffffff)',
                      borderRadius: '12px',
                      border: '1px solid var(--border-color, #e5e7eb)'
                    }}>
                      <div>
                        <div style={{ fontSize: '10.5px', color: 'var(--text-muted, #6b7280)', textTransform: 'uppercase', fontWeight: 600 }}>Connected Accounts</div>
                        <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary, #111827)', marginTop: '2px' }}>{accounts.length}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '10.5px', color: 'var(--text-muted, #6b7280)', textTransform: 'uppercase', fontWeight: 600 }}>Active Sessions</div>
                        <div style={{ fontSize: '16px', fontWeight: 800, color: '#059669', marginTop: '2px' }}>
                          {accounts.filter(a => checkAccountHealth(a) === 'connected').length}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: '10.5px', color: 'var(--text-muted, #6b7280)', textTransform: 'uppercase', fontWeight: 600 }}>Sync Status</div>
                        <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary, #111827)', marginTop: '2px' }}>
                          {isSyncingAll ? 'Syncing...' : 'Ready'}
                        </div>
                      </div>
                    </div>
                  )}

                  <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-primary, #111827)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <CheckCircle2 size={15} color="#059669" />
                    <span>Your Connected Accounts ({accounts.length})</span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
                    {accounts.map(acc => {
                      const health = checkAccountHealth(acc);
                      const brokerMeta = BROKER_LIST.find(b => b.id === acc.broker) || { name: acc.broker, color: '#3b82f6' };
                      const targetPf = portfolios.find(p => p.id === acc.portfolioId) || { name: 'Default' };
                      const isSyncing = syncingAccountId === acc.id;

                      return (
                        <div
                          key={acc.id}
                          style={{
                            padding: '14px',
                            borderRadius: '12px',
                            border: `1px solid ${health === 'expired' ? '#fecaca' : 'var(--border-color, #e5e7eb)'}`,
                            backgroundColor: 'var(--bg-primary, #f9fafb)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '10px'
                          }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <BrokerLogo broker={acc.broker} size={22} />
                              <div>
                                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary, #111827)' }}>
                                  {acc.accountName}
                                </div>
                                <div style={{ fontSize: '10px', color: 'var(--text-muted, #6b7280)' }}>
                                  {acc.clientId ? `ID: ${acc.clientId}` : brokerMeta.name} · {targetPf.name}
                                </div>
                              </div>
                            </div>

                            <span style={{
                              fontSize: '10px',
                              fontWeight: 700,
                              padding: '2px 8px',
                              borderRadius: '9999px',
                              backgroundColor: health === 'connected' ? '#ecfdf5' : health === 'expired' ? '#fef2f2' : '#f3f4f6',
                              color: health === 'connected' ? '#065f46' : health === 'expired' ? '#991b1b' : '#6b7280'
                            }}>
                              {health === 'connected' ? 'Connected' : health === 'expired' ? 'Expired' : 'Disconnected'}
                            </span>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '6px', borderTop: '1px solid var(--border-color, #f3f4f6)', fontSize: '11px' }}>
                            <div style={{ color: 'var(--text-muted, #6b7280)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <Clock size={12} />
                              <span>{formatExpiryNotice(acc.expiresAt)}</span>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <button
                                onClick={() => handleSyncSingleAccount(acc)}
                                disabled={isSyncing}
                                title="Sync trades from this account"
                                style={{
                                  padding: '4px 8px',
                                  borderRadius: '6px',
                                  backgroundColor: '#111827',
                                  color: '#ffffff',
                                  border: 'none',
                                  fontSize: '11px',
                                  fontWeight: 600,
                                  cursor: isSyncing ? 'not-allowed' : 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px'
                                }}>
                                <RefreshCw size={11} className={isSyncing ? 'animate-spin' : ''} />
                                <span>Sync</span>
                              </button>

                              <button
                                onClick={() => handleDeleteAccount(acc.id)}
                                title="Disconnect account"
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: '#ef4444',
                                  cursor: 'pointer',
                                  padding: '4px'
                                }}>
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Supported Brokers Grid */}
              <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-primary, #111827)', marginBottom: '12px' }}>
                Select a Broker to Connect or Manage
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: '14px' }}>
                {BROKER_LIST.map(b => {
                  const brokerAccs = accounts.filter(a => a.broker === b.id);
                  const isConnected = brokerAccs.length > 0;

                  return (
                    <div
                      key={b.id}
                      onClick={() => b.supportsApi ? setSelectedBroker(b) : null}
                      style={{
                        padding: '16px',
                        borderRadius: '14px',
                        border: isConnected ? `2px solid ${b.color}40` : '1px solid var(--border-color, #e5e7eb)',
                        backgroundColor: 'var(--bg-primary, #ffffff)',
                        cursor: b.supportsApi ? 'pointer' : 'default',
                        transition: 'all 0.2s ease',
                        position: 'relative',
                        opacity: b.supportsApi ? 1 : 0.65
                      }}
                      onMouseEnter={(e) => {
                        if (b.supportsApi) {
                          e.currentTarget.style.transform = 'translateY(-2px)';
                          e.currentTarget.style.boxShadow = '0 8px 20px -6px rgba(0,0,0,0.08)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (b.supportsApi) {
                          e.currentTarget.style.transform = 'none';
                          e.currentTarget.style.boxShadow = 'none';
                        }
                      }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                        <BrokerLogo broker={b.id} size={28} />
                        {isConnected ? (
                          <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '9999px', backgroundColor: '#ecfdf5', color: '#065f46' }}>
                            {brokerAccs.length} Active
                          </span>
                        ) : (
                          <span style={{ fontSize: '10px', fontWeight: 600, padding: '2px 8px', borderRadius: '9999px', backgroundColor: '#f3f4f6', color: '#6b7280' }}>
                            {b.supportsApi ? 'Available' : 'Coming Soon'}
                          </span>
                        )}
                      </div>

                      <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-primary, #111827)', marginBottom: '2px' }}>
                        {b.name}
                      </div>

                      <div style={{ fontSize: '11px', color: 'var(--text-muted, #6b7280)', marginBottom: '12px' }}>
                        {b.desc}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '8px', borderTop: '1px solid var(--border-color, #f3f4f6)' }}>
                        <span style={{ fontSize: '11px', fontWeight: 700, color: b.supportsApi ? b.color : '#9ca3af' }}>
                          {isConnected ? 'Manage Accounts →' : b.supportsApi ? '+ Connect API' : b.note}
                        </span>
                        {b.supportsApi && <ChevronRight size={14} color={b.color} />}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* VIEW 2: SELECTED BROKER ACCOUNT MANAGEMENT & ADD FORM */}
          {selectedBroker && (
            <div>
              {/* Top Details & Add Account Button */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px 20px',
                borderRadius: '14px',
                backgroundColor: `${selectedBroker.color}10`,
                border: `1px solid ${selectedBroker.color}30`,
                marginBottom: '20px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <BrokerLogo broker={selectedBroker.id} size={36} />
                  <div>
                    <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary, #111827)' }}>
                      {selectedBroker.name} Accounts
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted, #6b7280)' }}>
                      Connect multiple sub-accounts and map each to separate portfolios.
                    </div>
                  </div>
                </div>

                {!isAddingAccount && (
                  <button
                    onClick={() => handleStartAddAccount(selectedBroker)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '8px 16px',
                      borderRadius: '10px',
                      backgroundColor: selectedBroker.color,
                      color: '#ffffff',
                      border: 'none',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                    }}>
                    <Plus size={14} />
                    <span>Add New Account</span>
                  </button>
                )}
              </div>

              {/* Add Account Drawer Form */}
              {isAddingAccount ? (
                <form onSubmit={handleSaveAccount} style={{
                  padding: '20px',
                  borderRadius: '14px',
                  border: '1px solid var(--border-color, #e5e7eb)',
                  backgroundColor: 'var(--bg-primary, #ffffff)',
                  marginBottom: '24px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color, #f3f4f6)', paddingBottom: '10px' }}>
                    <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-primary, #111827)' }}>
                      Add {selectedBroker.name} Account Credentials
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsAddingAccount(false)}
                      style={{ background: 'none', border: 'none', color: '#6b7280', fontSize: '12px', cursor: 'pointer', fontWeight: 600 }}>
                      Cancel
                    </button>
                  </div>

                  {formError && (
                    <div style={{ padding: '8px 12px', borderRadius: '8px', backgroundColor: '#fef2f2', color: '#991b1b', fontSize: '12px', border: '1px solid #fecaca' }}>
                      {formError}
                    </div>
                  )}

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary, #374151)', marginBottom: '4px' }}>
                        Account Nickname
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Swing Trading Account"
                        value={formAccountName}
                        onChange={(e) => setFormAccountName(e.target.value)}
                        required
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          borderRadius: '8px',
                          border: '1px solid var(--border-color, #d1d5db)',
                          fontSize: '13px',
                          backgroundColor: 'var(--bg-card, #ffffff)'
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary, #374151)', marginBottom: '4px' }}>
                        Target Portfolio
                      </label>
                      <select
                        value={formPortfolioId}
                        onChange={(e) => setFormPortfolioId(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          borderRadius: '8px',
                          border: '1px solid var(--border-color, #d1d5db)',
                          fontSize: '13px',
                          backgroundColor: 'var(--bg-card, #ffffff)'
                        }}>
                        {portfolios.map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Broker Specific Fields */}
                  {selectedBroker.id === 'zerodha' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary, #374151)', marginBottom: '4px' }}>
                          Kite API Key (from kite.trade)
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. kite_api_key_12345"
                          value={formApiKey}
                          onChange={(e) => setFormApiKey(e.target.value)}
                          required
                          style={{
                            width: '100%',
                            padding: '8px 12px',
                            borderRadius: '8px',
                            border: '1px solid var(--border-color, #d1d5db)',
                            fontSize: '13px'
                          }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary, #374151)', marginBottom: '4px' }}>
                          Kite Daily Access Token
                        </label>
                        <input
                          type="password"
                          placeholder="Daily session token obtained after login"
                          value={formAccessToken}
                          onChange={(e) => setFormAccessToken(e.target.value)}
                          required
                          style={{
                            width: '100%',
                            padding: '8px 12px',
                            borderRadius: '8px',
                            border: '1px solid var(--border-color, #d1d5db)',
                            fontSize: '13px'
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {selectedBroker.id === 'dhan' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary, #374151)', marginBottom: '4px' }}>
                          Dhan Client ID
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. 1000293812"
                          value={formClientId}
                          onChange={(e) => setFormClientId(e.target.value)}
                          required
                          style={{
                            width: '100%',
                            padding: '8px 12px',
                            borderRadius: '8px',
                            border: '1px solid var(--border-color, #d1d5db)',
                            fontSize: '13px'
                          }}
                        />
                      </div>

                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                          <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary, #374151)' }}>
                            Dhan Access Token
                          </label>
                          <a
                            href="https://web.dhan.co"
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ fontSize: '11px', color: '#059669', display: 'flex', alignItems: 'center', gap: '2px', textDecoration: 'none', fontWeight: 600 }}>
                            <span>web.dhan.co → DhanHQ APIs</span>
                            <ExternalLink size={10} />
                          </a>
                        </div>
                        <input
                          type="password"
                          placeholder="eyJhbGciOiJSUzI1NiIsInR5cCI6Ik..."
                          value={formAccessToken}
                          onChange={(e) => setFormAccessToken(e.target.value)}
                          required
                          style={{
                            width: '100%',
                            padding: '8px 12px',
                            borderRadius: '8px',
                            border: '1px solid var(--border-color, #d1d5db)',
                            fontSize: '13px'
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {selectedBroker.id === 'upstox' && (
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary, #374151)', marginBottom: '4px' }}>
                        Upstox Access Token
                      </label>
                      <input
                        type="password"
                        placeholder="Upstox API v2 Access Token"
                        value={formAccessToken}
                        onChange={(e) => setFormAccessToken(e.target.value)}
                        required
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          borderRadius: '8px',
                          border: '1px solid var(--border-color, #d1d5db)',
                          fontSize: '13px'
                        }}
                      />
                    </div>
                  )}

                  {selectedBroker.id === 'fyers' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary, #374151)', marginBottom: '4px' }}>
                          FYERS App ID
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. XC90123-100"
                          value={formClientId}
                          onChange={(e) => setFormClientId(e.target.value)}
                          required
                          style={{
                            width: '100%',
                            padding: '8px 12px',
                            borderRadius: '8px',
                            border: '1px solid var(--border-color, #d1d5db)',
                            fontSize: '13px'
                          }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary, #374151)', marginBottom: '4px' }}>
                          FYERS Access Token
                        </label>
                        <input
                          type="password"
                          placeholder="FYERS v3 Daily Access Token"
                          value={formAccessToken}
                          onChange={(e) => setFormAccessToken(e.target.value)}
                          required
                          style={{
                            width: '100%',
                            padding: '8px 12px',
                            borderRadius: '8px',
                            border: '1px solid var(--border-color, #d1d5db)',
                            fontSize: '13px'
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {selectedBroker.id === 'angelone' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary, #374151)', marginBottom: '4px' }}>
                          Angel One Client Code
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. A123456"
                          value={formClientId}
                          onChange={(e) => setFormClientId(e.target.value)}
                          required
                          style={{
                            width: '100%',
                            padding: '8px 12px',
                            borderRadius: '8px',
                            border: '1px solid var(--border-color, #d1d5db)',
                            fontSize: '13px'
                          }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary, #374151)', marginBottom: '4px' }}>
                          SmartAPI Key
                        </label>
                        <input
                          type="text"
                          placeholder="Your Angel One API Key"
                          value={formApiKey}
                          onChange={(e) => setFormApiKey(e.target.value)}
                          required
                          style={{
                            width: '100%',
                            padding: '8px 12px',
                            borderRadius: '8px',
                            border: '1px solid var(--border-color, #d1d5db)',
                            fontSize: '13px'
                          }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary, #374151)', marginBottom: '4px' }}>
                          JWT Session Token
                        </label>
                        <input
                          type="password"
                          placeholder="Generated JWT token"
                          value={formAccessToken}
                          onChange={(e) => setFormAccessToken(e.target.value)}
                          required
                          style={{
                            width: '100%',
                            padding: '8px 12px',
                            borderRadius: '8px',
                            border: '1px solid var(--border-color, #d1d5db)',
                            fontSize: '13px'
                          }}
                        />
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-muted, #6b7280)' }}>
                      <ShieldCheck size={14} color="#059669" />
                      <span>Encrypted strictly in local browser storage.</span>
                    </div>

                    <button
                      type="submit"
                      style={{
                        padding: '9px 18px',
                        borderRadius: '8px',
                        backgroundColor: '#111827',
                        color: '#ffffff',
                        border: 'none',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}>
                      Save &amp; Connect Account
                    </button>
                  </div>
                </form>
              ) : null}

              {/* Connected Accounts for Selected Broker */}
              <div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary, #111827)', marginBottom: '10px' }}>
                  Accounts Connected ({accounts.filter(a => a.broker === selectedBroker.id).length})
                </div>

                {accounts.filter(a => a.broker === selectedBroker.id).length === 0 ? (
                  <div style={{
                    padding: '30px',
                    textAlign: 'center',
                    border: '1px dashed var(--border-color, #cbd5e1)',
                    borderRadius: '12px',
                    color: 'var(--text-muted, #6b7280)',
                    fontSize: '13px'
                  }}>
                    No accounts connected for {selectedBroker.name} yet. Click <strong>"Add New Account"</strong> above to get started.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {accounts.filter(a => a.broker === selectedBroker.id).map(acc => {
                      const health = checkAccountHealth(acc);
                      const targetPf = portfolios.find(p => p.id === acc.portfolioId) || { name: 'Default' };
                      const isSyncing = syncingAccountId === acc.id;

                      return (
                        <div
                          key={acc.id}
                          style={{
                            padding: '16px',
                            borderRadius: '12px',
                            border: `1px solid ${health === 'expired' ? '#fecaca' : 'var(--border-color, #e5e7eb)'}`,
                            backgroundColor: 'var(--bg-primary, #ffffff)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between'
                          }}>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                              <span style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-primary, #111827)' }}>
                                {acc.accountName}
                              </span>
                              <span style={{
                                fontSize: '10px',
                                fontWeight: 700,
                                padding: '2px 8px',
                                borderRadius: '9999px',
                                backgroundColor: health === 'connected' ? '#ecfdf5' : '#fef2f2',
                                color: health === 'connected' ? '#065f46' : '#991b1b'
                              }}>
                                {health === 'connected' ? 'Active' : 'Expired'}
                              </span>
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted, #6b7280)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                              {acc.clientId && <span>ID: <strong>{acc.clientId}</strong></span>}
                              <span>Target Portfolio: <strong>{targetPf.name}</strong></span>
                              <span>{formatExpiryNotice(acc.expiresAt)}</span>
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <button
                              onClick={() => handleSyncSingleAccount(acc)}
                              disabled={isSyncing}
                              style={{
                                padding: '6px 12px',
                                borderRadius: '8px',
                                backgroundColor: '#059669',
                                color: '#ffffff',
                                border: 'none',
                                fontSize: '12px',
                                fontWeight: 700,
                                cursor: isSyncing ? 'not-allowed' : 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}>
                              <RefreshCw size={12} className={isSyncing ? 'animate-spin' : ''} />
                              <span>Sync Trades</span>
                            </button>

                            <button
                              onClick={() => handleDeleteAccount(acc.id)}
                              style={{
                                padding: '6px 10px',
                                borderRadius: '8px',
                                backgroundColor: '#fef2f2',
                                color: '#dc2626',
                                border: '1px solid #fecaca',
                                fontSize: '12px',
                                fontWeight: 600,
                                cursor: 'pointer'
                              }}>
                              Disconnect
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer - Manual CSV Import shortcut */}
        <div style={{
          padding: '14px 28px',
          borderTop: '1px solid var(--border-color, #e5e7eb)',
          backgroundColor: 'var(--bg-primary, #f9fafb)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '12px'
        }}>
          <div style={{ color: 'var(--text-muted, #6b7280)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>Have a CSV, Excel, or PDF tradebook statement?</span>
            <button
              onClick={() => {
                onClose();
                if (onSwitchToImportFile) onSwitchToImportFile();
              }}
              style={{
                background: 'none',
                border: 'none',
                color: '#2563eb',
                fontWeight: 700,
                cursor: 'pointer',
                padding: 0,
                textDecoration: 'underline'
              }}>
              Switch to File Import →
            </button>
          </div>

          <div style={{ fontSize: '11px', color: 'var(--text-muted, #9ca3af)' }}>
            Active Portfolio: <strong>{currentPortfolio.name}</strong>
          </div>
        </div>
      </div>
    </div>
  );
}
