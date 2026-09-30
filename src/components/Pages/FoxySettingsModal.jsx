import React, { useState, useEffect } from 'react';
import { X, ExternalLink, Eye, EyeOff, Check, AlertCircle } from 'lucide-react';
import { AI_PROVIDERS, getFoxyConfig, saveFoxyConfig, testFoxyApiKey } from '../../services/foxyAiService';
import FoxTradeLogo from '../FoxTradeLogo';

export default function FoxySettingsModal({ isOpen, onClose, onConfigSaved }) {
  const [selectedProviderId, setSelectedProviderId] = useState('gemini');
  const [selectedModel, setSelectedModel] = useState('gemini-3-flash-preview');
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState(null); // { success: boolean, message: string }
  const [isSaving, setIsSaving] = useState(false);

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
      backgroundColor: 'rgba(0, 0, 0, 0.4)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 100,
      padding: '16px'
    }}>
      <div style={{
        backgroundColor: '#ffffff',
        width: '100%',
        maxWidth: '480px',
        borderRadius: '16px',
        border: '1px solid #e5e7eb',
        boxShadow: '0 20px 40px -15px rgba(0, 0, 0, 0.12)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
        color: '#111827'
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid #f3f4f6',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: '#ffffff'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <FoxTradeLogo size={22} />
            <span style={{ fontSize: '15px', fontWeight: 700, color: '#111827' }}>
              Foxy AI Settings
            </span>
          </div>

          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              background: 'none',
              border: 'none',
              color: '#9ca3af',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          
          {/* Provider Selection */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#4b5563', marginBottom: '8px' }}>
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
                      border: `1px solid ${isSelected ? '#111827' : '#e5e7eb'}`,
                      backgroundColor: isSelected ? '#111827' : '#ffffff',
                      color: isSelected ? '#ffffff' : '#374151',
                      cursor: 'pointer',
                      textAlign: 'center',
                      fontSize: '12px',
                      fontWeight: isSelected ? 600 : 500,
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) e.currentTarget.style.backgroundColor = '#f9fafb';
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) e.currentTarget.style.backgroundColor = '#ffffff';
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
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#4b5563', marginBottom: '8px' }}>
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
                border: '1px solid #e5e7eb',
                backgroundColor: '#ffffff',
                fontSize: '13px',
                color: '#111827',
                outline: 'none'
              }}
            >
              {currentProvider.models.map(m => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          {/* API Key Input */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#4b5563' }}>
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
                    color: '#2563eb',
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
                  border: '1px solid #e5e7eb',
                  backgroundColor: '#ffffff',
                  fontSize: '13px',
                  fontFamily: 'monospace',
                  color: '#111827',
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
                  color: '#9ca3af',
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
                  border: '1px solid #e5e7eb',
                  backgroundColor: '#ffffff',
                  fontSize: '12px',
                  fontWeight: 500,
                  color: '#374151',
                  cursor: isTesting || !apiKey.trim() ? 'not-allowed' : 'pointer',
                  opacity: isTesting || !apiKey.trim() ? 0.5 : 1
                }}
                onMouseEnter={(e) => {
                  if (!isTesting && apiKey.trim()) e.currentTarget.style.backgroundColor = '#f9fafb';
                }}
                onMouseLeave={(e) => {
                  if (!isTesting && apiKey.trim()) e.currentTarget.style.backgroundColor = '#ffffff';
                }}
              >
                {isTesting ? 'Verifying...' : 'Test Connection'}
              </button>

              <span style={{ fontSize: '11px', color: '#9ca3af' }}>
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
                backgroundColor: testResult.success ? '#f0fdf4' : '#fef2f2',
                color: testResult.success ? '#15803d' : '#b91c1c',
                border: `1px solid ${testResult.success ? '#bbf7d0' : '#fecaca'}`
              }}>
                {testResult.success ? <Check size={14} /> : <AlertCircle size={14} />}
                <span>{testResult.message}</span>
              </div>
            )}

            {/* Privacy & Free-Tier Disclosure */}
            <div style={{
              marginTop: '16px',
              padding: '10px 12px',
              backgroundColor: '#f8fafc',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              fontSize: '11px',
              lineHeight: '1.45',
              color: '#64748b'
            }}>
              <span style={{ fontWeight: 600, color: '#334155' }}>🔒 Privacy & Zero-Key Note: </span>
              Your API key never leaves your browser (stored in IndexedDB). Queries are sent directly to the model provider. If using a Google Gemini free-tier key, Google may log prompts for model training. To keep 100% data private, use a paid API key or leave blank to run in <b>Offline Heuristic Mode</b>.
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 20px',
          borderTop: '1px solid #f3f4f6',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: '10px',
          backgroundColor: '#fafbfc'
        }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: '1px solid #e5e7eb',
              backgroundColor: '#ffffff',
              fontSize: '13px',
              fontWeight: 500,
              color: '#374151',
              cursor: 'pointer'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ffffff'}
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
              backgroundColor: '#111827',
              fontSize: '13px',
              fontWeight: 600,
              color: '#ffffff',
              cursor: isSaving ? 'not-allowed' : 'pointer',
              opacity: isSaving ? 0.7 : 1
            }}
            onMouseEnter={(e) => {
              if (!isSaving) e.currentTarget.style.backgroundColor = '#1f2937';
            }}
            onMouseLeave={(e) => {
              if (!isSaving) e.currentTarget.style.backgroundColor = '#111827';
            }}
          >
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
