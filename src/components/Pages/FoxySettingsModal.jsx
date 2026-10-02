import React, { useState, useEffect } from 'react';
import { X, ExternalLink, Eye, EyeOff, Check, AlertCircle } from 'lucide-react';
import { AI_PROVIDERS, getFoxyConfig, saveFoxyConfig, testFoxyApiKey } from '../../services/foxyAiService';
import FoxTradeLogo from '../FoxTradeLogo';

export default function FoxySettingsModal({ isOpen, onClose, onConfigSaved, themeMode, isDark: propIsDark }) {
  const [selectedProviderId, setSelectedProviderId] = useState('gemini');
  const [selectedModel, setSelectedModel] = useState('gemini-3-flash-preview');
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState(null); // { success: boolean, message: string }
  const [isSaving, setIsSaving] = useState(false);

  // Theme resolution: props take priority, with reactive DOM/localStorage fallback
  const isDark = propIsDark !== undefined
    ? propIsDark
    : (themeMode === 'dark' || themeMode === 'pitch-black' ||
       (typeof document !== 'undefined' && (
         document.documentElement.classList.contains('dark') ||
         document.documentElement.getAttribute('data-theme') === 'dark' ||
         document.documentElement.getAttribute('data-theme') === 'pitch-black'
       )));
  const isPitchBlack = themeMode === 'pitch-black' ||
    (typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'pitch-black');

  // Palette tokens
  const theme = {
    modalBg: isPitchBlack ? '#000000' : isDark ? '#1e293b' : '#ffffff',
    headerBg: isPitchBlack ? '#000000' : isDark ? '#1e293b' : '#ffffff',
    footerBg: isPitchBlack ? '#050505' : isDark ? '#0f172a' : '#fafbfc',
    border: isPitchBlack ? '#262626' : isDark ? '#334155' : '#e5e7eb',
    borderLight: isPitchBlack ? '#1f1f1f' : isDark ? '#334155' : '#f3f4f6',
    textPrimary: isPitchBlack ? '#ffffff' : isDark ? '#f8fafc' : '#111827',
    textSecondary: isPitchBlack ? '#e5e5e5' : isDark ? '#e2e8f0' : '#374151',
    textMuted: isPitchBlack ? '#a3a3a3' : isDark ? '#94a3b8' : '#6b7280',
    textLabel: isPitchBlack ? '#d4d4d4' : isDark ? '#cbd5e1' : '#4b5563',
    inputBg: isPitchBlack ? '#0a0a0a' : isDark ? '#0f172a' : '#ffffff',
    btnSecondaryBg: isPitchBlack ? '#171717' : isDark ? '#1e293b' : '#ffffff',
    btnSecondaryHover: isPitchBlack ? '#262626' : isDark ? '#334155' : '#f9fafb',
    btnPrimaryBg: isDark ? '#3b82f6' : '#111827',
    btnPrimaryHover: isDark ? '#2563eb' : '#1f2937',
    disclosureBg: isPitchBlack ? '#0a0a0a' : isDark ? '#0f172a' : '#f8fafc',
    disclosureTitle: isPitchBlack ? '#e5e5e5' : isDark ? '#e2e8f0' : '#334155',
  };

  useEffect(() => {
    if (isOpen) {
      getFoxyConfig().then(cfg => {
        if (cfg.provider) setSelectedProviderId(cfg.provider);
        if (cfg.model) setSelectedModel(cfg.model);
        if (cfg.apiKey) setApiKey(cfg.apiKey);
        setTestResult(null);
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const currentProvider = AI_PROVIDERS.find(p => p.id === selectedProviderId) || AI_PROVIDERS[0];

  const handleProviderChange = (providerId) => {
    setSelectedProviderId(providerId);
    const prov = AI_PROVIDERS.find(p => p.id === providerId);
    if (prov) {
      setSelectedModel(prov.defaultModel || prov.models[0]?.id);
    }
    setTestResult(null);
  };

  const handleTestKey = async () => {
    if (!apiKey.trim()) {
      setTestResult({ success: false, message: 'Please enter an API key first.' });
      return;
    }
    setIsTesting(true);
    setTestResult(null);
    try {
      await testFoxyApiKey(selectedProviderId, selectedModel, apiKey.trim());
      setTestResult({ success: true, message: 'Connection verified successfully.' });
    } catch (err) {
      setTestResult({ success: false, message: err.message || 'Verification failed. Please check your key.' });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await saveFoxyConfig({
        provider: selectedProviderId,
        model: selectedModel,
        apiKey: apiKey.trim()
      });
      if (onConfigSaved) {
        onConfigSaved({
          provider: selectedProviderId,
          model: selectedModel,
          apiKey: apiKey.trim()
        });
      }
      onClose();
    } catch (err) {
      console.error('[FoxySettings] Save failed:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: isDark ? 'rgba(0, 0, 0, 0.7)' : 'rgba(0, 0, 0, 0.4)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 100,
      padding: '16px'
    }}>
      <div style={{
        backgroundColor: theme.modalBg,
        width: '100%',
        maxWidth: '480px',
        borderRadius: '16px',
        border: `1px solid ${theme.border}`,
        boxShadow: isDark ? '0 25px 50px -12px rgba(0, 0, 0, 0.7)' : '0 20px 40px -15px rgba(0, 0, 0, 0.12)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
        color: theme.textPrimary
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: `1px solid ${theme.borderLight}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: theme.headerBg
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <FoxTradeLogo size={22} />
            <span style={{ fontSize: '15px', fontWeight: 700, color: theme.textPrimary }}>
              Foxy AI Settings
            </span>
          </div>

          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              background: 'none',
              border: 'none',
              color: theme.textMuted,
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background-color 0.15s ease'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = theme.btnSecondaryHover}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          
          {/* Provider Selection */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: theme.textLabel, marginBottom: '8px' }}>
              AI Provider
            </label>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '6px'
            }}>
              {AI_PROVIDERS.map(prov => {
                const isSelected = prov.id === selectedProviderId;
                return (
                  <button
                    key={prov.id}
                    type="button"
                    onClick={() => handleProviderChange(prov.id)}
                    style={{
                      padding: '8px 10px',
                      borderRadius: '8px',
                      border: `1px solid ${isSelected ? (isDark ? '#3b82f6' : '#111827') : theme.border}`,
                      backgroundColor: isSelected ? (isDark ? '#3b82f6' : '#111827') : theme.inputBg,
                      color: isSelected ? '#ffffff' : theme.textSecondary,
                      cursor: 'pointer',
                      textAlign: 'center',
                      fontSize: '12px',
                      fontWeight: isSelected ? 600 : 500,
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) e.currentTarget.style.backgroundColor = theme.btnSecondaryHover;
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) e.currentTarget.style.backgroundColor = theme.inputBg;
                    }}
                  >
                    {prov.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Model Selector */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: theme.textLabel, marginBottom: '8px' }}>
              Model
            </label>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              style={{
                width: '100%',
                height: '38px',
                padding: '0 10px',
                borderRadius: '8px',
                border: `1px solid ${theme.border}`,
                backgroundColor: theme.inputBg,
                fontSize: '13px',
                color: theme.textPrimary,
                outline: 'none'
              }}
            >
              {currentProvider.models.map(m => (
                <option key={m.id} value={m.id} style={{ backgroundColor: theme.inputBg, color: theme.textPrimary }}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          {/* API Key Input */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: theme.textLabel }}>
                API Key
              </label>
              {currentProvider.keyHelpUrl && (
                <a
                  href={currentProvider.keyHelpUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    fontSize: '12px',
                    fontWeight: 500,
                    color: isDark ? '#60a5fa' : '#2563eb',
                    textDecoration: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <span>Get API Key</span>
                  <ExternalLink size={11} />
                </a>
              )}
            </div>

            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input
                type={showKey ? 'text' : 'password'}
                placeholder={currentProvider.keyPlaceholder || 'Enter your API key...'}
                value={apiKey}
                onChange={(e) => {
                  setApiKey(e.target.value);
                  setTestResult(null);
                }}
                style={{
                  width: '100%',
                  height: '38px',
                  padding: '0 36px 0 12px',
                  borderRadius: '8px',
                  border: `1px solid ${theme.border}`,
                  backgroundColor: theme.inputBg,
                  fontSize: '13px',
                  fontFamily: 'monospace',
                  color: theme.textPrimary,
                  outline: 'none'
                }}
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                aria-label={showKey ? 'Hide key' : 'Show key'}
                style={{
                  position: 'absolute',
                  right: '8px',
                  background: 'none',
                  border: 'none',
                  color: theme.textMuted,
                  cursor: 'pointer',
                  padding: '4px'
                }}
              >
                {showKey ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>

            {/* Test Action and Local Storage Note */}
            <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <button
                type="button"
                onClick={handleTestKey}
                disabled={isTesting || !apiKey.trim()}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: `1px solid ${theme.border}`,
                  backgroundColor: theme.btnSecondaryBg,
                  fontSize: '12px',
                  fontWeight: 500,
                  color: theme.textSecondary,
                  cursor: isTesting || !apiKey.trim() ? 'not-allowed' : 'pointer',
                  opacity: isTesting || !apiKey.trim() ? 0.5 : 1,
                  transition: 'background-color 0.15s ease'
                }}
                onMouseEnter={(e) => {
                  if (!isTesting && apiKey.trim()) e.currentTarget.style.backgroundColor = theme.btnSecondaryHover;
                }}
                onMouseLeave={(e) => {
                  if (!isTesting && apiKey.trim()) e.currentTarget.style.backgroundColor = theme.btnSecondaryBg;
                }}
              >
                {isTesting ? 'Verifying...' : 'Test Connection'}
              </button>

              <span style={{ fontSize: '11px', color: theme.textMuted }}>
                Stored locally in IndexedDB
              </span>
            </div>

            {/* Test Result Message */}
            {testResult && (
              <div style={{
                marginTop: '10px',
                padding: '8px 12px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                backgroundColor: testResult.success
                  ? (isDark ? 'rgba(34, 197, 94, 0.15)' : '#f0fdf4')
                  : (isDark ? 'rgba(239, 68, 68, 0.15)' : '#fef2f2'),
                color: testResult.success
                  ? (isDark ? '#4ade80' : '#15803d')
                  : (isDark ? '#f87171' : '#b91c1c'),
                border: `1px solid ${testResult.success
                  ? (isDark ? 'rgba(34, 197, 94, 0.35)' : '#bbf7d0')
                  : (isDark ? 'rgba(239, 68, 68, 0.35)' : '#fecaca')}`
              }}>
                {testResult.success ? <Check size={14} /> : <AlertCircle size={14} />}
                <span>{testResult.message}</span>
              </div>
            )}

            {/* Privacy & Free-Tier Disclosure */}
            <div style={{
              marginTop: '16px',
              padding: '10px 12px',
              backgroundColor: theme.disclosureBg,
              borderRadius: '8px',
              border: `1px solid ${theme.border}`,
              fontSize: '11px',
              lineHeight: '1.45',
              color: theme.textMuted
            }}>
              <span style={{ fontWeight: 600, color: theme.disclosureTitle }}>🔒 Privacy & Zero-Key Note: </span>
              Your API key never leaves your browser (stored in IndexedDB). Queries are sent directly to the model provider. If using a Google Gemini free-tier key, Google may log prompts for model training. To keep 100% data private, use a paid API key or leave blank to run in <b>Offline Heuristic Mode</b>.
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 20px',
          borderTop: `1px solid ${theme.borderLight}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: '10px',
          backgroundColor: theme.footerBg
        }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: `1px solid ${theme.border}`,
              backgroundColor: theme.btnSecondaryBg,
              fontSize: '13px',
              fontWeight: 500,
              color: theme.textSecondary,
              cursor: 'pointer',
              transition: 'background-color 0.15s ease'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = theme.btnSecondaryHover}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = theme.btnSecondaryBg}
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            style={{
              padding: '8px 20px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: theme.btnPrimaryBg,
              fontSize: '13px',
              fontWeight: 600,
              color: '#ffffff',
              cursor: isSaving ? 'not-allowed' : 'pointer',
              opacity: isSaving ? 0.7 : 1,
              transition: 'background-color 0.15s ease'
            }}
            onMouseEnter={(e) => {
              if (!isSaving) e.currentTarget.style.backgroundColor = theme.btnPrimaryHover;
            }}
            onMouseLeave={(e) => {
              if (!isSaving) e.currentTarget.style.backgroundColor = theme.btnPrimaryBg;
            }}
          >
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
