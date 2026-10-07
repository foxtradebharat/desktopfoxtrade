import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Upload,
  Zap,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRight,
  ArrowLeft,
  Settings2,
  FileSpreadsheet,
  Check,
  Search,
  Filter,
  ShieldCheck,
  RefreshCw,
  SlidersHorizontal,
  Info,
  Wifi,
  WifiOff,
  Timer
} from 'lucide-react';
import BrokerLogo from './BrokerLogo';
import { SUPPORTED_BROKERS, previewTradesFromFile, normalizeDateString } from '../utils/tradeImportEngine';
import { pairExecutionFills } from '../services/brokerApiService';
import { useBrokerSync } from '../hooks/useBrokerSync';
import { saveToken, getToken, getTokenState, getExpiryLabel } from '../services/brokerTokenManager';
import { fetchLiveCMPForSymbol } from '../services/strikePriceService';

export default function BrokerImportModal({
  isOpen,
  onClose,
  onFileSelected,
  onSyncedTrades,
  onOpenBrokerConnectivity,
  activePortfolioId = 'portfolio-default',
  portfolios = [],
  liveCMPs = {}
}) {
  const [modalTab, setModalTab] = useState('file-import'); // 'file-import' | 'api-sync' | 'column-mapper'
  const [currentStep, setCurrentStep] = useState(1); // 1: Upload, 2: Configure, 3: Preview
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);

  // Selected File and Preview State
  const [selectedFile, setSelectedFile] = useState(null);
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState(null);
  const [previewData, setPreviewData] = useState(null);

  // Import Configuration Options
  const [dateFormat, setDateFormat] = useState('auto'); // 'auto' | 'DD-MM-YYYY' | 'YYYY-MM-DD' | 'MM-DD-YYYY'
  const [consolidateFills, setConsolidateFills] = useState(true);
  const [selectedTradeIds, setSelectedTradeIds] = useState(new Set());
  const [previewSearch, setPreviewSearch] = useState('');

  // Direct API Sync — backed by Web Worker via useBrokerSync hook
  const [apiBroker, setApiBroker] = useState('dhan');
  const [apiKey, setApiKey]       = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [clientId, setClientId]   = useState('');
  const [apiSyncStatus, setApiSyncStatus] = useState(null);
  const { startSync, isSyncing: isApiSyncing, progress: syncProgress, error: syncError, resetSync } = useBrokerSync();

  // Load saved token on broker change
  useEffect(() => {
    async function loadSavedToken() {
      const accountId = clientId || apiKey || 'default';
      const saved = await getToken(apiBroker, accountId);
      if (saved) {
        setAccessToken(saved.accessToken || '');
        setApiKey(saved.apiKey || '');
        setClientId(saved.clientId || saved.accountId || '');
      } else {
        setAccessToken('');
        setApiKey('');
        setClientId('');
      }
    }
    loadSavedToken();
  }, [apiBroker]);

  // Direct API Sync Handler — runs inside Web Worker
  const handleDirectBrokerSync = async (e) => {
    e.preventDefault();
    setApiSyncStatus(null);
    resetSync();

    const credentials = { apiKey, accessToken, clientId };

    try {
      // Run sync in Web Worker (non-blocking)
      const { fills, rawCount } = await startSync(apiBroker, credentials);

      // Encrypt and save token for future use
      const accountId = clientId || apiKey || 'default';
      await saveToken(apiBroker, accountId, { accessToken, apiKey, clientId });

      const pairedTrades = pairExecutionFills(fills);
      setApiSyncStatus({
        type: 'success',
        message: `✓ Fetched ${rawCount} fills → ${pairedTrades.length} trades from ${apiBroker.toUpperCase()}`
      });

      if (onSyncedTrades && pairedTrades.length > 0) {
        onSyncedTrades(pairedTrades);
      }
    } catch (err) {
      setApiSyncStatus({
        type: 'error',
        message: err.message || 'Failed to sync with broker API.'
      });
    }
  };



  // Reset state on open/close
  useEffect(() => {
    if (!isOpen) {
      setCurrentStep(1);
      setSelectedFile(null);
      setPreviewData(null);
      setParseError(null);
      setApiSyncStatus(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Handle Drag & Drop
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else if (e.type === 'dragleave') setDragActive(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processChosenFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      try { e.target.value = ''; } catch {}
      processChosenFile(file);
    }
  };

  const processChosenFile = async (file) => {
    setSelectedFile(file);
    setIsParsing(true);
    setParseError(null);

    try {
      const preview = await previewTradesFromFile(file, {
        dateFormat,
        consolidate: consolidateFills,
        activePortfolioId,
        liveCMPs
      });

      // Fetch live CMP for any open positions missing CMP
      if (preview?.trades?.length > 0) {
        const missingSymbols = [...new Set(
          preview.trades
            .filter(t => (t.status === 'Open' || t.status === 'Partial') && (!t.cmp || Number(t.cmp) === 0))
            .map(t => (t.name || t.symbol || '').trim())
            .filter(Boolean)
        )];

        if (missingSymbols.length > 0) {
          await Promise.allSettled(
            missingSymbols.map(async (sym) => {
              try {
                const p = await fetchLiveCMPForSymbol(sym, true);
                if (p > 0) {
                  preview.trades.forEach(t => {
                    if ((t.name === sym || t.symbol === sym) && (!t.cmp || Number(t.cmp) === 0)) {
                      t.cmp = p;
                      if (t.avgEntry && t.qty) {
                        t.pnl = Math.round(((p - t.avgEntry) * t.qty) * 100) / 100;
                      }
                    }
                  });
                }
              } catch (_) {}
            })
          );
        }
      }

      setPreviewData(preview);
      // Select all trades by default
      const allIds = new Set(preview.trades.map((t, idx) => t.id || `row_${idx}`));
      setSelectedTradeIds(allIds);
      setCurrentStep(2); // Advance to configuration step
    } catch (err) {
      console.error('File Preview Error:', err);
      setParseError(err.message || 'Failed to parse tradebook file.');
    } finally {
      setIsParsing(false);
    }
  };

  const handleReRunPreview = async (newDateFormat, newConsolidate) => {
    if (!selectedFile) return;
    setIsParsing(true);
    setParseError(null);
    try {
      const preview = await previewTradesFromFile(selectedFile, {
        dateFormat: newDateFormat !== undefined ? newDateFormat : dateFormat,
        consolidate: newConsolidate !== undefined ? newConsolidate : consolidateFills,
        activePortfolioId,
        liveCMPs
      });
      setPreviewData(preview);
      const allIds = new Set(preview.trades.map((t, idx) => t.id || `row_${idx}`));
      setSelectedTradeIds(allIds);
    } catch (err) {
      setParseError(err.message || 'Failed to update preview.');
    } finally {
      setIsParsing(false);
    }
  };

  const handleToggleTrade = (tradeId) => {
    setSelectedTradeIds(prev => {
      const next = new Set(prev);
      if (next.has(tradeId)) next.delete(tradeId);
      else next.add(tradeId);
      return next;
    });
  };

  const handleToggleAll = () => {
    if (!previewData) return;
    if (selectedTradeIds.size === previewData.trades.length) {
      setSelectedTradeIds(new Set());
    } else {
      setSelectedTradeIds(new Set(previewData.trades.map((t, idx) => t.id || `row_${idx}`)));
    }
  };

  const handleCommitImport = () => {
    if (!previewData || !previewData.trades) return;
    const finalTrades = previewData.trades.filter((t, idx) => selectedTradeIds.has(t.id || `row_${idx}`));
    if (finalTrades.length === 0) {
      alert('Please select at least one trade to import.');
      return;
    }

    if (onSyncedTrades) {
      onSyncedTrades(finalTrades);
    } else if (onFileSelected) {
      onFileSelected(selectedFile);
    }
    onClose();
  };

  // Filter preview trades by search term
  const filteredPreviewTrades = (previewData?.trades || []).filter(t => {
    if (!previewSearch) return true;
    const q = previewSearch.toLowerCase();
    return (t.name || '').toLowerCase().includes(q) || (t.setup || '').toLowerCase().includes(q);
  });

  const totalSelectedCount = selectedTradeIds.size;
  const totalPreviewCount = previewData?.trades?.length || 0;

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
        maxWidth: currentStep === 3 ? '920px' : '720px',
        maxHeight: '90vh',
        boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.3)',
        border: '1px solid var(--border-color, #e5e7eb)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        position: 'relative',
        transition: 'max-width 0.2s ease',
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif"
      }}>
        {/* Modal Header */}
        <div style={{
          padding: '22px 28px 16px 28px',
          borderBottom: '1px solid var(--border-color, #e5e7eb)',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          backgroundColor: 'var(--bg-primary, #f9fafb)'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
              <h2 style={{ margin: 0, fontSize: '19px', fontWeight: 800, color: 'var(--text-primary, #111827)' }}>
                Import Trades &amp; Tradebooks
              </h2>
            </div>
            <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted, #6b7280)' }}>
              Universal import supporting all major Indian brokers and custom Excel spreadsheets
            </p>
          </div>

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

        {/* Top Tab Bar: File Import vs Direct API Sync */}
        <div style={{
          display: 'flex',
          padding: '8px 28px 0 28px',
          backgroundColor: 'var(--bg-primary, #f9fafb)',
          borderBottom: '1px solid var(--border-color, #e5e7eb)',
          gap: '8px'
        }}>
          <button
            onClick={() => setModalTab('file-import')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              border: 'none',
              borderBottom: modalTab === 'file-import' ? '2px solid #111827' : '2px solid transparent',
              backgroundColor: 'transparent',
              color: modalTab === 'file-import' ? 'var(--text-primary, #111827)' : 'var(--text-muted, #6b7280)',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}>
            <Upload size={14} />
            <span>Universal File Import</span>
          </button>

          <button
            onClick={() => setModalTab('api-sync')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              border: 'none',
              borderBottom: modalTab === 'api-sync' ? '2px solid #111827' : '2px solid transparent',
              backgroundColor: 'transparent',
              color: modalTab === 'api-sync' ? 'var(--text-primary, #111827)' : 'var(--text-muted, #6b7280)',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}>
            <Zap size={14} color={modalTab === 'api-sync' ? '#059669' : '#6b7280'} />
            <span>Direct Broker API Sync</span>
          </button>

          {onOpenBrokerConnectivity && (
            <button
              onClick={() => {
                onClose();
                onOpenBrokerConnectivity();
              }}
              style={{
                marginLeft: 'auto',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '6px 12px',
                borderRadius: '8px',
                backgroundColor: 'rgba(0, 0, 0, 0.04)',
                border: '1px solid var(--border-color, #e5e7eb)',
                color: 'var(--text-secondary, #374151)',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
                marginBottom: '6px'
              }}>
              <SlidersHorizontal size={12} />
              <span>Manage Broker Accounts →</span>
            </button>
          )}
        </div>

        {/* ── TAB 1: UNIVERSAL FILE IMPORT (MULTI-STEP WIZARD) ─────────── */}
        {modalTab === 'file-import' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Step Progress Indicators */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '12px 28px',
              backgroundColor: 'var(--bg-card, #ffffff)',
              borderBottom: '1px solid var(--border-color, #f3f4f6)',
              fontSize: '12px'
            }}>
              {[
                { step: 1, label: 'Upload' },
                { step: 2, label: 'Configure & Date' },
                { step: 3, label: 'Preview & Import' }
              ].map((s, idx) => (
                <React.Fragment key={s.step}>
                  <div
                    onClick={() => {
                      if (currentStep > s.step) setCurrentStep(s.step);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      cursor: currentStep > s.step ? 'pointer' : 'default',
                      opacity: currentStep >= s.step ? 1 : 0.4
                    }}>
                    <span style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      backgroundColor: currentStep === s.step ? '#111827' : currentStep > s.step ? '#059669' : '#e5e7eb',
                      color: currentStep >= s.step ? '#ffffff' : '#6b7280',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '10px',
                      fontWeight: 800
                    }}>
                      {currentStep > s.step ? <Check size={12} /> : s.step}
                    </span>
                    <span style={{
                      fontWeight: currentStep === s.step ? 700 : 500,
                      color: currentStep === s.step ? 'var(--text-primary, #111827)' : 'var(--text-muted, #6b7280)'
                    }}>
                      {s.label}
                    </span>
                  </div>
                  {idx < 2 && <div style={{ width: '24px', height: '1px', backgroundColor: 'var(--border-color, #e5e7eb)' }} />}
                </React.Fragment>
              ))}
            </div>

            {/* Step Content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
              
              {/* STEP 1: UPLOAD DROPZONE */}
              {currentStep === 1 && (
                <div>
                  {/* Supported Brokers Logos Strip */}
                  <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted, #9ca3af)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                      Native Tradebook Recognition For All Indian Brokers
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      {['zerodha', 'dhan', 'upstox', 'groww', 'angelone', 'fyers', 'mstock', 'kotak', 'motilal', 'icici'].map(b => (
                        <div
                          key={b}
                          title={b}
                          style={{
                            padding: '4px 8px',
                            borderRadius: '8px',
                            backgroundColor: 'rgba(0, 0, 0, 0.03)',
                            border: '1px solid var(--border-color, #e5e7eb)',
                            display: 'flex',
                            alignItems: 'center'
                          }}>
                          <BrokerLogo broker={b} size={16} />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Dropzone */}
                  <div
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      border: dragActive ? '2px dashed #111827' : '1px dashed var(--border-color, #cbd5e1)',
                      borderRadius: '16px',
                      padding: '44px 24px',
                      backgroundColor: dragActive ? '#f8fafc' : 'var(--bg-primary, #ffffff)',
                      textAlign: 'center',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      position: 'relative'
                    }}>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv,.xlsx,.xls,.xml,.pdf,.json"
                      onChange={handleFileChange}
                      style={{ display: 'none' }}
                    />

                    <div style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '50%',
                      backgroundColor: 'var(--bg-card, #ffffff)',
                      border: '1px solid var(--border-color, #e2e8f0)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto 16px',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
                    }}>
                      <Upload size={22} color="#6b7280" />
                    </div>

                    <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary, #111827)', marginBottom: '4px' }}>
                      {isParsing ? 'Inspecting & Analyzing Tradebook...' : 'Upload Tradebook, History, or Exchange Statement'}
                    </div>

                    <p style={{ margin: '0 auto 16px', fontSize: '12px', color: 'var(--text-muted, #6b7280)', maxWidth: '440px' }}>
                      Drag and drop your file here, or browse files. Supports CSV, XLSX, XLS, XML (ProStocks), and JSON backups.
                    </p>

                    <div style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '6px 14px',
                      borderRadius: '9999px',
                      backgroundColor: 'rgba(0, 0, 0, 0.04)',
                      fontSize: '11px',
                      fontWeight: 600,
                      color: 'var(--text-secondary, #4b5563)'
                    }}>
                      <FileSpreadsheet size={13} />
                      <span>Multiple year tradebooks supported in one go</span>
                    </div>
                  </div>

                  {parseError && (
                    <div style={{
                      marginTop: '16px',
                      padding: '12px',
                      borderRadius: '10px',
                      backgroundColor: '#fef2f2',
                      border: '1px solid #fecaca',
                      color: '#991b1b',
                      fontSize: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      <AlertCircle size={16} />
                      <span>{parseError}</span>
                    </div>
                  )}
                </div>
              )}

              {/* STEP 2: CONFIGURE & DATE AMBIGUITY RESOLUTION */}
              {currentStep === 2 && previewData && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {/* Broker Detected Banner */}
                  <div style={{
                    padding: '14px 18px',
                    borderRadius: '14px',
                    backgroundColor: 'rgba(5, 150, 105, 0.06)',
                    border: '1px solid rgba(5, 150, 105, 0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <BrokerLogo broker={previewData.detectedBroker} size={28} />
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-primary, #111827)' }}>
                          Detected: {previewData.brokerDisplayName}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted, #6b7280)' }}>
                          {selectedFile?.name} ({previewData.totalRows} execution rows parsed)
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => setCurrentStep(1)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-muted, #6b7280)',
                        fontSize: '11px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        textDecoration: 'underline'
                      }}>
                      Change File
                    </button>
                  </div>

                  {/* Date Format Disambiguation Box */}
                  <div style={{
                    padding: '18px',
                    borderRadius: '14px',
                    border: '1px solid var(--border-color, #e5e7eb)',
                    backgroundColor: 'var(--bg-primary, #f9fafb)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 800, color: 'var(--text-primary, #111827)', marginBottom: '4px' }}>
                      <Clock size={15} />
                      <span>Date Format Verification</span>
                    </div>
                    <p style={{ margin: '0 0 12px 0', fontSize: '11px', color: 'var(--text-muted, #6b7280)' }}>
                      Prevent date distortion (e.g. 05-04 being confused as May 4 vs April 5). Select the format matching your broker statement:
                    </p>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '14px' }}>
                      {[
                        { id: 'auto', label: 'Auto (Indian Standard)', sub: 'DD-MM-YYYY' },
                        { id: 'DD-MM-YYYY', label: 'Day First', sub: 'DD-MM-YYYY (e.g. 24-03-2024)' },
                        { id: 'MM-DD-YYYY', label: 'Month First', sub: 'MM-DD-YYYY (US Standard)' }
                      ].map(df => (
                        <button
                          key={df.id}
                          type="button"
                          onClick={() => {
                            setDateFormat(df.id);
                            handleReRunPreview(df.id, consolidateFills);
                          }}
                          style={{
                            padding: '10px',
                            borderRadius: '10px',
                            border: dateFormat === df.id ? '2px solid #111827' : '1px solid var(--border-color, #d1d5db)',
                            backgroundColor: dateFormat === df.id ? '#ffffff' : 'transparent',
                            cursor: 'pointer',
                            textAlign: 'left'
                          }}>
                          <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary, #111827)' }}>
                            {df.label}
                          </div>
                          <div style={{ fontSize: '10px', color: 'var(--text-muted, #6b7280)' }}>
                            {df.sub}
                          </div>
                        </button>
                      ))}
                    </div>

                    {/* Sample Date Interpretation Preview */}
                    {previewData.sampleDates && previewData.sampleDates.length > 0 && (
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary, #374151)', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 700 }}>Previewed Dates:</span>
                        {previewData.sampleDates.map((sd, i) => (
                          <span key={i} style={{ padding: '2px 6px', borderRadius: '4px', backgroundColor: '#e5e7eb', fontSize: '10px', fontFamily: 'monospace' }}>
                            {sd.raw} ➔ <strong>{sd.parsed}</strong>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Consolidation Options */}
                  <div style={{
                    padding: '18px',
                    borderRadius: '14px',
                    border: '1px solid var(--border-color, #e5e7eb)',
                    backgroundColor: 'var(--bg-primary, #f9fafb)'
                  }}>
                    <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-primary, #111827)', marginBottom: '4px' }}>
                      Multi-Fill Consolidation
                    </div>
                    <p style={{ margin: '0 0 12px 0', fontSize: '11px', color: 'var(--text-muted, #6b7280)' }}>
                      Choose how execution fills across the same stock should be journaled:
                    </p>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer' }}>
                        <input
                          type="radio"
                          name="consolidation"
                          checked={consolidateFills === true}
                          onChange={() => {
                            setConsolidateFills(true);
                            handleReRunPreview(dateFormat, true);
                          }}
                          style={{ marginTop: '2px' }}
                        />
                        <div>
                          <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary, #111827)' }}>
                            Consolidate into Pyramided Trades (Recommended)
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted, #6b7280)' }}>
                            Fills on the same stock are combined into one journal trade with initial entry, pyramid legs (P1, P2), and exits (E1, E2, E3).
                          </div>
                        </div>
                      </label>

                      <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer' }}>
                        <input
                          type="radio"
                          name="consolidation"
                          checked={consolidateFills === false}
                          onChange={() => {
                            setConsolidateFills(false);
                            handleReRunPreview(dateFormat, false);
                          }}
                          style={{ marginTop: '2px' }}
                        />
                        <div>
                          <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary, #111827)' }}>
                            Keep Every Fill as an Individual Trade
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted, #6b7280)' }}>
                            Every single order execution row is imported as its own independent open trade.
                          </div>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Continue Button */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                    <button
                      onClick={() => setCurrentStep(1)}
                      style={{
                        padding: '10px 16px',
                        borderRadius: '10px',
                        border: '1px solid var(--border-color, #d1d5db)',
                        backgroundColor: 'transparent',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}>
                      Back
                    </button>
                    <button
                      onClick={() => setCurrentStep(3)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '10px 22px',
                        borderRadius: '10px',
                        backgroundColor: '#111827',
                        color: '#ffffff',
                        border: 'none',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}>
                      <span>Proceed to Preview ({previewData.tradesCount} Trades)</span>
                      <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 3: INTERACTIVE PREVIEW & SELECTION TABLE */}
              {currentStep === 3 && previewData && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {/* Summary Bar & Search */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-primary, #111827)' }}>
                        Parsed Trades Preview
                      </span>
                      <span style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: '9999px',
                        backgroundColor: '#ecfdf5',
                        color: '#065f46'
                      }}>
                        {totalSelectedCount} of {totalPreviewCount} Selected
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ position: 'relative' }}>
                        <Search size={13} color="#9ca3af" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
                        <input
                          type="text"
                          placeholder="Filter symbols..."
                          value={previewSearch}
                          onChange={(e) => setPreviewSearch(e.target.value)}
                          style={{
                            padding: '6px 12px 6px 28px',
                            borderRadius: '8px',
                            border: '1px solid var(--border-color, #d1d5db)',
                            fontSize: '11px',
                            width: '150px'
                          }}
                        />
                      </div>

                      <button
                        onClick={handleToggleAll}
                        style={{
                          padding: '6px 10px',
                          borderRadius: '8px',
                          border: '1px solid var(--border-color, #d1d5db)',
                          backgroundColor: 'transparent',
                          fontSize: '11px',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}>
                        {selectedTradeIds.size === totalPreviewCount ? 'Deselect All' : 'Select All'}
                      </button>
                    </div>
                  </div>

                  {/* Preview Table */}
                  <div style={{
                    border: '1px solid var(--border-color, #e5e7eb)',
                    borderRadius: '12px',
                    overflow: 'hidden',
                    maxHeight: '360px',
                    overflowY: 'auto'
                  }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11.5px' }}>
                      <thead style={{ position: 'sticky', top: 0, backgroundColor: 'var(--bg-primary, #f9fafb)', borderBottom: '1px solid var(--border-color, #e5e7eb)', zIndex: 2 }}>
                        <tr>
                          <th style={{ padding: '8px 10px', textAlign: 'center', width: '32px' }}>
                            <input
                              type="checkbox"
                              checked={selectedTradeIds.size === totalPreviewCount && totalPreviewCount > 0}
                              onChange={handleToggleAll}
                            />
                          </th>
                          <th style={{ padding: '8px 10px', textAlign: 'left' }}>#</th>
                          <th style={{ padding: '8px 10px', textAlign: 'left' }}>Date</th>
                          <th style={{ padding: '8px 10px', textAlign: 'left' }}>Symbol</th>
                          <th style={{ padding: '8px 10px', textAlign: 'left' }}>Side</th>
                          <th style={{ padding: '8px 10px', textAlign: 'right' }}>Entry</th>
                          <th style={{ padding: '8px 10px', textAlign: 'right' }}>Qty</th>
                          <th style={{ padding: '8px 10px', textAlign: 'right' }}>Avg Exit</th>
                          <th style={{ padding: '8px 10px', textAlign: 'center' }}>Status</th>
                          <th style={{ padding: '8px 10px', textAlign: 'right' }}>P&amp;L</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredPreviewTrades.map((t, idx) => {
                          const rowKey = t.id || `row_${idx}`;
                          const isSelected = selectedTradeIds.has(rowKey);
                          const isProfit = (t.pnl || 0) > 0;
                          const isLoss = (t.pnl || 0) < 0;

                          return (
                            <tr
                              key={rowKey}
                              onClick={() => handleToggleTrade(rowKey)}
                              style={{
                                borderBottom: '1px solid var(--border-color, #f3f4f6)',
                                backgroundColor: isSelected ? 'transparent' : 'rgba(0,0,0,0.02)',
                                opacity: isSelected ? 1 : 0.45,
                                cursor: 'pointer'
                              }}>
                              <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => handleToggleTrade(rowKey)}
                                  onClick={(e) => e.stopPropagation()}
                                />
                              </td>
                              <td style={{ padding: '8px 10px', color: 'var(--text-muted, #6b7280)' }}>{idx + 1}</td>
                              <td style={{ padding: '8px 10px', fontWeight: 600 }}>{t.date}</td>
                              <td style={{ padding: '8px 10px', fontWeight: 700 }}>{t.name}</td>
                              <td style={{ padding: '8px 10px' }}>
                                <span style={{
                                  fontSize: '10px',
                                  fontWeight: 700,
                                  padding: '1px 6px',
                                  borderRadius: '4px',
                                  backgroundColor: t.type === 'Sell' ? '#fef2f2' : '#ecfdf5',
                                  color: t.type === 'Sell' ? '#dc2626' : '#059669'
                                }}>
                                  {t.type}
                                </span>
                              </td>
                              <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600 }}>₹{Number(t.entry || t.avgEntry || 0).toFixed(2)}</td>
                              <td style={{ padding: '8px 10px', textAlign: 'right' }}>{t.qty}</td>
                              <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                                {t.avgExitPrice ? `₹${Number(t.avgExitPrice).toFixed(2)}` : '—'}
                              </td>
                              <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                                <span style={{
                                  fontSize: '10px',
                                  fontWeight: 700,
                                  padding: '1px 6px',
                                  borderRadius: '4px',
                                  backgroundColor: t.status === 'Closed' ? '#f3f4f6' : '#eff6ff',
                                  color: t.status === 'Closed' ? '#374151' : '#2563eb'
                                }}>
                                  {t.status || 'Closed'}
                                </span>
                              </td>
                              <td style={{
                                padding: '8px 10px',
                                textAlign: 'right',
                                fontWeight: 700,
                                color: isProfit ? '#059669' : isLoss ? '#dc2626' : 'var(--text-muted, #6b7280)'
                              }}>
                                {t.pnl !== undefined && t.pnl !== null ? `₹${Number(t.pnl).toLocaleString('en-IN')}` : '—'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Actions Footer */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '10px' }}>
                    <button
                      onClick={() => setCurrentStep(2)}
                      style={{
                        padding: '10px 16px',
                        borderRadius: '10px',
                        border: '1px solid var(--border-color, #d1d5db)',
                        backgroundColor: 'transparent',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}>
                      ← Back to Options
                    </button>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <button
                        onClick={handleCommitImport}
                        disabled={totalSelectedCount === 0}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '10px 24px',
                          borderRadius: '10px',
                          backgroundColor: '#059669',
                          color: '#ffffff',
                          border: 'none',
                          fontSize: '13px',
                          fontWeight: 800,
                          cursor: totalSelectedCount === 0 ? 'not-allowed' : 'pointer',
                          boxShadow: '0 2px 4px rgba(5, 150, 105, 0.2)'
                        }}>
                        <CheckCircle2 size={16} />
                        <span>Commit &amp; Import ({totalSelectedCount} Trades)</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

            </div>
          </div>
        )}

        {/* ── TAB 2: DIRECT BROKER API SYNC ────────────────────────────── */}
        {modalTab === 'api-sync' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
            <form onSubmit={handleDirectBrokerSync} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Broker Selector */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-primary, #374151)', marginBottom: '8px' }}>
                  Select Broker for Direct Sync
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                  {[
                    { id: 'dhan', name: 'Dhan HQ', desc: 'Permanent / Free API', color: '#059669' },
                    { id: 'zerodha', name: 'Zerodha Kite', desc: 'Kite Connect v3', color: '#e44b36' },
                    { id: 'upstox', name: 'Upstox v2', desc: 'OAuth 2.0 API', color: '#7c3aed' },
                    { id: 'fyers', name: 'FYERS v3', desc: 'Daily Tradebook API', color: '#0ea5e9' },
                    { id: 'angelone', name: 'Angel One', desc: 'SmartAPI Trading', color: '#ef4444' }
                  ].map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => setApiBroker(b.id)}
                      style={{
                        padding: '12px',
                        borderRadius: '12px',
                        border: apiBroker === b.id ? `2px solid ${b.color}` : '1px solid var(--border-color, #e5e7eb)',
                        backgroundColor: apiBroker === b.id ? `${b.color}10` : 'var(--bg-primary, #ffffff)',
                        cursor: 'pointer',
                        textAlign: 'left'
                      }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <BrokerLogo broker={b.id} size={20} />
                        <div style={{ fontSize: '13px', fontWeight: 800, color: apiBroker === b.id ? b.color : 'var(--text-primary, #111827)' }}>
                          {b.name}
                        </div>
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted, #6b7280)' }}>
                        {b.desc}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Dynamic Inputs */}
              {apiBroker === 'dhan' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary, #374151)', marginBottom: '4px' }}>
                      Dhan Client ID
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 1000293812"
                      value={clientId}
                      onChange={(e) => setClientId(e.target.value)}
                      required
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color, #d1d5db)', fontSize: '13px' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary, #374151)', marginBottom: '4px' }}>
                      Dhan Access Token (from web.dhan.co → DhanHQ APIs)
                    </label>
                    <input
                      type="password"
                      placeholder="eyJhbGciOiJSUzI1NiIsInR5cCI6Ik..."
                      value={accessToken}
                      onChange={(e) => setAccessToken(e.target.value)}
                      required
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color, #d1d5db)', fontSize: '13px' }}
                    />
                  </div>
                </div>
              )}

              {apiBroker === 'zerodha' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary, #374151)', marginBottom: '4px' }}>
                      Kite API Key
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. kite_api_key"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      required
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color, #d1d5db)', fontSize: '13px' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary, #374151)', marginBottom: '4px' }}>
                      Kite Daily Access Token
                    </label>
                    <input
                      type="password"
                      placeholder="Daily session token"
                      value={accessToken}
                      onChange={(e) => setAccessToken(e.target.value)}
                      required
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color, #d1d5db)', fontSize: '13px' }}
                    />
                  </div>
                </div>
              )}

              {apiBroker === 'upstox' && (
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary, #374151)', marginBottom: '4px' }}>
                    Upstox Access Token
                  </label>
                  <input
                    type="password"
                    placeholder="Upstox API v2 Token"
                    value={accessToken}
                    onChange={(e) => setAccessToken(e.target.value)}
                    required
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color, #d1d5db)', fontSize: '13px' }}
                  />
                </div>
              )}

              {apiBroker === 'fyers' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary, #374151)', marginBottom: '4px' }}>
                      FYERS App ID
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. FYERS_APP_ID"
                      value={clientId}
                      onChange={(e) => setClientId(e.target.value)}
                      required
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color, #d1d5db)', fontSize: '13px' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary, #374151)', marginBottom: '4px' }}>
                      FYERS Access Token
                    </label>
                    <input
                      type="password"
                      placeholder="Daily v3 access token"
                      value={accessToken}
                      onChange={(e) => setAccessToken(e.target.value)}
                      required
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color, #d1d5db)', fontSize: '13px' }}
                    />
                  </div>
                </div>
              )}

              {apiBroker === 'angelone' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary, #374151)', marginBottom: '4px' }}>
                      Angel One Client Code
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. A123456"
                      value={clientId}
                      onChange={(e) => setClientId(e.target.value)}
                      required
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color, #d1d5db)', fontSize: '13px' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary, #374151)', marginBottom: '4px' }}>
                      SmartAPI Key
                    </label>
                    <input
                      type="text"
                      placeholder="SmartAPI Key"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      required
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color, #d1d5db)', fontSize: '13px' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary, #374151)', marginBottom: '4px' }}>
                      JWT Session Token
                    </label>
                    <input
                      type="password"
                      placeholder="JWT Session Token"
                      value={accessToken}
                      onChange={(e) => setAccessToken(e.target.value)}
                      required
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color, #d1d5db)', fontSize: '13px' }}
                    />
                  </div>
                </div>
              )}

              {apiSyncStatus && (
                <div style={{
                  padding: '10px 14px',
                  borderRadius: '10px',
                  fontSize: '12px',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  backgroundColor: apiSyncStatus.type === 'success' ? '#ecfdf5' : '#fef2f2',
                  color: apiSyncStatus.type === 'success' ? '#065f46' : '#991b1b',
                  border: `1px solid ${apiSyncStatus.type === 'success' ? '#a7f3d0' : '#fecaca'}`
                }}>
                  {apiSyncStatus.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                  <span>{apiSyncStatus.message}</span>
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-muted, #6b7280)' }}>
                  <ShieldCheck size={14} color="#059669" />
                  <span>Tokens are encrypted locally on this browser.</span>
                </div>

                <button
                  type="submit"
                  disabled={isApiSyncing}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '10px 20px',
                    backgroundColor: '#059669',
                    color: '#ffffff',
                    borderRadius: '10px',
                    border: 'none',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: isApiSyncing ? 'not-allowed' : 'pointer',
                    boxShadow: '0 2px 4px rgba(5, 150, 105, 0.2)'
                  }}>
                  <RefreshCw size={14} className={isApiSyncing ? 'animate-spin' : ''} />
                  <span>{isApiSyncing ? 'Connecting & Syncing...' : 'Sync Today’s Trades'}</span>
                </button>
              </div>
            </form>
          </div>
        )}

      </div>
    </div>
  );
}
