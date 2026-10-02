import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  X, 
  Upload, 
  Link as LinkIcon, 
  Image as ImageIcon, 
  Trash2, 
  Loader2, 
  ExternalLink 
} from 'lucide-react';

/**
 * Compresses an image file or blob to WebP format using HTML5 Canvas.
 * Preserves high visual fidelity for charts while reducing payload size significantly.
 */
function compressToWebP(fileOrBlob, quality = 0.85, maxDimension = 2560) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;

        // Downscale proportionally only if abnormally huge
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(e.target.result);
          return;
        }

        // Fill background with white in case of transparent png charts
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        try {
          const webpDataUrl = canvas.toDataURL('image/webp', quality);
          if (webpDataUrl && webpDataUrl.startsWith('data:image/webp')) {
            resolve(webpDataUrl);
            return;
          }
        } catch (err) {
          console.warn('WebP export fallback:', err);
        }

        // Fallback to high quality JPEG if WebP isn't supported
        try {
          const jpegDataUrl = canvas.toDataURL('image/jpeg', quality);
          resolve(jpegDataUrl);
        } catch {
          resolve(e.target.result);
        }
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(fileOrBlob);
  });
}

/**
 * Resolves TradingView snapshot links to direct high-res image URLs.
 * Example: https://www.tradingview.com/x/sP674175/ -> https://s3.tradingview.com/snapshots/s/sP674175.png
 */
function resolveTradingViewUrl(url) {
  const trimmed = (url || '').trim();
  const tvMatch = trimmed.match(/tradingview\.com\/x\/([a-zA-Z0-9_-]+)/i);
  if (tvMatch) {
    const id = tvMatch[1];
    const firstChar = id.charAt(0).toLowerCase();
    return `https://s3.tradingview.com/snapshots/${firstChar}/${id}.png`;
  }
  return trimmed;
}

/**
 * Slot Uploader Component
 * Supports 'file' upload (drag & drop, click, paste) and 'url' (TradingView URL)
 */
function SlotUploader({ 
  label, 
  currentImage, 
  onImageUploaded, 
  onImageDeleted, 
  isDark, 
  onViewImage 
}) {
  const [tab, setTab] = useState('file'); // 'file' | 'url'
  const [tvUrl, setTvUrl] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  const fileInputRef = useRef(null);

  // Handle incoming file (from input, drop, or clipboard paste)
  const processFile = useCallback(async (file) => {
    if (!file || !file.type.startsWith('image/')) {
      setErrorMessage('Please select a valid image file (PNG, JPG, WebP).');
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      setErrorMessage('File size exceeds 15MB limit.');
      return;
    }

    setErrorMessage(null);
    setIsProcessing(true);

    try {
      // Compress to WebP with 0.85 quality
      const webpDataUrl = await compressToWebP(file, 0.85);
      onImageUploaded(webpDataUrl);
    } catch (err) {
      console.error('Failed to process image:', err);
      setErrorMessage('Failed to compress and upload image.');
    } finally {
      setIsProcessing(false);
    }
  }, [onImageUploaded]);

  // Handle TradingView URL import
  const handleImportTvUrl = async () => {
    if (!tvUrl.trim()) return;

    setErrorMessage(null);
    setIsProcessing(true);

    const directUrl = resolveTradingViewUrl(tvUrl);

    // If it's already a data URL, set directly
    if (directUrl.startsWith('data:')) {
      onImageUploaded(directUrl);
      setTvUrl('');
      setIsProcessing(false);
      return;
    }

    try {
      // Try to load and compress to WebP
      const img = new Image();
      img.crossOrigin = 'anonymous';

      const dataUrl = await new Promise((resolve) => {
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth || img.width;
            canvas.height = img.naturalHeight || img.height;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0);
            const webp = canvas.toDataURL('image/webp', 0.85);
            resolve(webp);
          } catch {
            resolve(directUrl);
          }
        };
        img.onerror = () => {
          // If cross-origin prevents canvas reading, save direct image URL
          resolve(directUrl);
        };
        img.src = directUrl;
      });

      onImageUploaded(dataUrl);
      setTvUrl('');
    } catch (err) {
      console.error('TradingView import error:', err);
      onImageUploaded(directUrl);
      setTvUrl('');
    } finally {
      setIsProcessing(false);
    }
  };

  // Drag & Drop handlers
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const file = e.dataTransfer.files && e.dataTransfer.files[0];
    if (file) {
      processFile(file);
    }
  };

  // Paste handler for clipboard images
  const handlePaste = (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const blob = items[i].getAsFile();
        if (blob) {
          processFile(blob);
          e.preventDefault();
          break;
        }
      }
    }
  };

  const borderCol = isDark ? 'rgba(255, 255, 255, 0.1)' : '#e5e7eb';
  const textMuted = isDark ? '#9ca3af' : '#6b7280';
  const bgCard = isDark ? '#0b0f19' : '#f9fafb';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
      {/* Label: BEFORE ENTRY / AFTER EXIT */}
      <h3 style={{
        fontSize: '10px',
        fontWeight: 700,
        color: isDark ? 'rgba(156, 163, 175, 0.6)' : 'rgba(107, 114, 128, 0.6)',
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
        margin: 0,
        paddingLeft: '4px'
      }}>
        {label}
      </h3>

      {/* Hidden file input */}
      <input 
        type="file" 
        ref={fileInputRef} 
        style={{ display: 'none' }} 
        accept="image/png,image/jpeg,image/jpg,image/webp" 
        onChange={(e) => {
          const file = e.target.files && e.target.files[0];
          if (file) processFile(file);
          e.target.value = '';
        }} 
      />

      {/* CASE A: IMAGE IS ATTACHED (Preview Card with Hover Overlay) */}
      {currentImage ? (
        <div 
          className="chart-card-group"
          style={{
            position: 'relative',
            width: '100%',
            height: '160px',
            borderRadius: '8px',
            border: isDark ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid #e5e7eb',
            backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          {/* Chart Image */}
          <img 
            src={currentImage} 
            alt={label} 
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              transition: 'opacity 0.2s ease'
            }} 
          />

          {/* Hover Overlay (View, Replace, Delete) */}
          <div 
            className="chart-card-overlay"
            style={{
              position: 'absolute',
              inset: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.45)',
              backdropFilter: 'blur(2px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              opacity: 0,
              transition: 'opacity 0.2s ease',
              borderRadius: '8px'
            }}
          >
            {/* View Button */}
            <button
              onClick={() => onViewImage ? onViewImage(currentImage) : window.open(currentImage, '_blank')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '28px',
                padding: '0 12px',
                fontSize: '11px',
                fontWeight: 600,
                borderRadius: '6px',
                border: 'none',
                backgroundColor: isDark ? '#374151' : '#ffffff',
                color: isDark ? '#f9fafb' : '#111827',
                cursor: 'pointer',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.2)'
              }}
            >
              View
            </button>

            {/* Replace Button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '28px',
                padding: '0 12px',
                fontSize: '11px',
                fontWeight: 600,
                borderRadius: '6px',
                border: 'none',
                backgroundColor: isDark ? '#374151' : '#ffffff',
                color: isDark ? '#f9fafb' : '#111827',
                cursor: 'pointer',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.2)'
              }}
            >
              Replace
            </button>

            {/* Delete / Trash Button */}
            <button
              onClick={onImageDeleted}
              title="Delete Chart"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '28px',
                height: '28px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: 'rgba(255, 255, 255, 0.15)',
                color: 'rgba(255, 255, 255, 0.9)',
                cursor: 'pointer',
                transition: 'background-color 0.15s, color 0.15s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#ef4444';
                e.currentTarget.style.color = '#ffffff';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.15)';
                e.currentTarget.style.color = 'rgba(255, 255, 255, 0.9)';
              }}
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      ) : (
        /* CASE B: NO IMAGE YET (Upload File / TradingView URL Tabs) */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }} onPaste={handlePaste}>
          {/* Tabs */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            borderBottom: `1px solid ${borderCol}`,
            fontSize: '11px'
          }}>
            <button
              type="button"
              onClick={() => setTab('file')}
              style={{
                background: 'none',
                border: 'none',
                borderBottom: tab === 'file' ? (isDark ? '2px solid #f9fafb' : '2px solid #111827') : '2px solid transparent',
                padding: '4px 4px',
                fontSize: '11px',
                fontWeight: tab === 'file' ? 700 : 500,
                color: tab === 'file' ? (isDark ? '#f9fafb' : '#111827') : textMuted,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px'
              }}
            >
              <Upload size={12} />
              <span>Upload File</span>
            </button>

            <button
              type="button"
              onClick={() => setTab('url')}
              style={{
                background: 'none',
                border: 'none',
                borderBottom: tab === 'url' ? (isDark ? '2px solid #f9fafb' : '2px solid #111827') : '2px solid transparent',
                padding: '4px 4px',
                fontSize: '11px',
                fontWeight: tab === 'url' ? 700 : 500,
                color: tab === 'url' ? (isDark ? '#f9fafb' : '#111827') : textMuted,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px'
              }}
            >
              <LinkIcon size={12} />
              <span>TradingView URL</span>
            </button>
          </div>

          {/* Tab Content */}
          {tab === 'file' ? (
            /* Drag & Drop Zone */
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: dragActive 
                  ? (isDark ? '2px dashed rgba(255, 255, 255, 0.4)' : '2px dashed #111827')
                  : (isDark ? '2px dashed rgba(255, 255, 255, 0.15)' : '2px dashed #d1d5db'),
                backgroundColor: dragActive 
                  ? (isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)') 
                  : (isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.01)'),
                borderRadius: '12px',
                padding: '24px 16px',
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '120px'
              }}
            >
              {isProcessing ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                  <Loader2 size={20} className="animate-spin" color={isDark ? '#f9fafb' : '#111827'} />
                  <span style={{ fontSize: '11px', fontWeight: 700, color: isDark ? '#f9fafb' : '#111827' }}>
                    Compressing to WebP...
                  </span>
                </div>
              ) : (
                <>
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '8px',
                    color: textMuted
                  }}>
                    <ImageIcon size={16} />
                  </div>
                  <p style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    margin: '0 0 2px 0',
                    color: isDark ? '#f3f4f6' : '#111827'
                  }}>
                    Drop image here or click to upload
                  </p>
                  <p style={{
                    fontSize: '9px',
                    color: textMuted,
                    margin: 0
                  }}>
                    Auto-compressed to high-res WebP • Ctrl+V to paste
                  </p>
                </>
              )}
            </div>
          ) : (
            /* TradingView URL Import Input */
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              padding: '12px 4px'
            }}>
              <input
                type="text"
                placeholder="Paste TradingView snapshot URL..."
                value={tvUrl}
                onChange={(e) => setTvUrl(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleImportTvUrl(); }}
                disabled={isProcessing}
                style={{
                  height: '34px',
                  borderRadius: '6px',
                  border: isDark ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid #d1d5db',
                  backgroundColor: isDark ? '#111827' : '#ffffff',
                  color: isDark ? '#f9fafb' : '#111827',
                  padding: '0 10px',
                  fontSize: '12px',
                  outline: 'none',
                  width: '100%',
                  boxSizing: 'border-box'
                }}
              />

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={handleImportTvUrl}
                  disabled={!tvUrl.trim() || isProcessing}
                  style={{
                    height: '28px',
                    padding: '0 14px',
                    borderRadius: '6px',
                    border: 'none',
                    backgroundColor: isDark ? '#f9fafb' : '#111827',
                    color: isDark ? '#111827' : '#ffffff',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: !tvUrl.trim() || isProcessing ? 'not-allowed' : 'pointer',
                    opacity: !tvUrl.trim() || isProcessing ? 0.5 : 1,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    transition: 'opacity 0.15s ease'
                  }}
                >
                  {isProcessing && <Loader2 size={12} className="animate-spin" />}
                  <span>{isProcessing ? 'Importing...' : 'Import Chart'}</span>
                </button>
              </div>
            </div>
          )}

          {errorMessage && (
            <div style={{
              fontSize: '10px',
              color: '#ef4444',
              padding: '4px 8px',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              borderRadius: '4px'
            }}>
              {errorMessage}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function UploadChartModal({ 
  isOpen, 
  onClose, 
  trade, 
  onSave, 
  themeMode = 'light' 
}) {
  const isDark = themeMode === 'dark' || themeMode === 'pitch-black';

  const [chartBefore, setChartBefore] = useState('');
  const [chartAfter, setChartAfter] = useState('');
  const [previewModalImg, setPreviewModalImg] = useState(null);

  // Sync state when trade opens
  useEffect(() => {
    if (trade) {
      setChartBefore(trade.chartBefore || (trade.images && trade.images[0]) || '');
      setChartAfter(trade.chartAfter || (trade.images && trade.images[1]) || '');
    }
  }, [trade, isOpen]);

  // Global ESC key listener to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (previewModalImg) {
          setPreviewModalImg(null);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, previewModalImg, onClose]);

  if (!isOpen || !trade) return null;

  const handleDone = () => {
    if (onSave) {
      onSave(trade.id, {
        chartBefore,
        chartAfter
      });
    }
    onClose();
  };

  const borderCol = isDark ? 'rgba(255, 255, 255, 0.1)' : '#e5e7eb';
  const bgSurface = isDark ? '#111827' : '#ffffff';
  const textPrimary = isDark ? '#f9fafb' : '#111827';
  const textMuted = isDark ? '#9ca3af' : '#6b7280';

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        animation: 'fadeIn 0.15s ease'
      }}
    >
      <style>{`
        .chart-card-group:hover .chart-card-overlay {
          opacity: 1 !important;
        }
      `}</style>
      {/* Modal Dialog Card (max-w-[800px] border rounded-xl overflow-hidden) */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '800px',
          backgroundColor: bgSurface,
          borderRadius: '12px',
          border: `1px solid ${borderCol}`,
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.1)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          position: 'relative'
        }}
      >
        {/* Top Header */}
        <div style={{
          padding: '16px 16px 4px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <h2 style={{
            fontSize: '18px',
            fontWeight: 700,
            letterSpacing: '-0.025em',
            margin: 0,
            color: textPrimary
          }}>
            Upload Chart Images
          </h2>

          {/* Close X button */}
          <button
            onClick={onClose}
            title="Close"
            style={{
              background: 'none',
              border: 'none',
              color: textMuted,
              cursor: 'pointer',
              padding: '4px',
              borderRadius: '4px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* 2-Column Grid (BEFORE ENTRY | AFTER EXIT) */}
        <div style={{
          padding: '16px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '16px'
        }}>
          {/* Column 1: Before Entry */}
          <SlotUploader 
            label="Before Entry"
            currentImage={chartBefore}
            onImageUploaded={(img) => setChartBefore(img)}
            onImageDeleted={() => setChartBefore('')}
            isDark={isDark}
            onViewImage={(url) => setPreviewModalImg(url)}
          />

          {/* Column 2: After Exit */}
          <SlotUploader 
            label="After Exit"
            currentImage={chartAfter}
            onImageUploaded={(img) => setChartAfter(img)}
            onImageDeleted={() => setChartAfter('')}
            isDark={isDark}
            onViewImage={(url) => setPreviewModalImg(url)}
          />
        </div>

        {/* Bottom Footer */}
        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          padding: '12px 16px',
          backgroundColor: isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.02)',
          borderTop: `1px solid ${borderCol}`
        }}>
          <button
            onClick={handleDone}
            style={{
              height: '32px',
              padding: '0 16px',
              fontSize: '12px',
              fontWeight: 600,
              borderRadius: '6px',
              border: 'none',
              backgroundColor: isDark ? '#374151' : '#f1f5f9',
              color: textPrimary,
              cursor: 'pointer',
              transition: 'background-color 0.15s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = isDark ? '#4b5563' : '#e2e8f0'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = isDark ? '#374151' : '#f1f5f9'}
          >
            Done
          </button>
        </div>
      </div>

      {/* Full Size Image Preview Modal (When clicking View) */}
      {previewModalImg && (
        <div
          onClick={() => setPreviewModalImg(null)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10000,
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px'
          }}
        >
          <div style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh' }}>
            <img 
              src={previewModalImg} 
              alt="Full Chart View" 
              style={{
                maxWidth: '100%',
                maxHeight: '90vh',
                objectFit: 'contain',
                borderRadius: '8px',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
              }}
            />
            <button
              onClick={() => setPreviewModalImg(null)}
              style={{
                position: 'absolute',
                top: '-14px',
                right: '-14px',
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                backgroundColor: '#1f2937',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
