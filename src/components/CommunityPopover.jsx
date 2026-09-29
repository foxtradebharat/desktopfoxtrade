import React, { useEffect, useRef } from 'react';
import { COMMUNITY_LINKS } from '../data/communityLinks';

/**
 * High-res official Telegram Icon
 */
export function TelegramIcon({ size = 20, style = {} }) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      style={{ flexShrink: 0, display: 'block', ...style }}
    >
      <circle cx="12" cy="12" r="12" fill="#24A1DE" />
      <path 
        fillRule="evenodd" 
        clipRule="evenodd" 
        d="M5.414 11.966c4.78-2.083 7.967-3.456 9.562-4.118 4.553-1.895 5.5-2.225 6.117-2.236.136-.002.44.031.637.191.166.135.212.318.234.446.022.128.05.42.028.647-.253 2.66-1.353 9.144-1.908 12.113-.235 1.256-.7 1.677-1.148 1.718-.973.089-1.713-.643-2.655-1.26-1.474-.967-2.306-1.569-3.734-2.51-1.65-1.087-.58-1.684.36-2.664.246-.257 4.52-4.143 4.6-4.482.01-.042.02-.2-.073-.284-.093-.083-.23-.055-.33-.032-.14.032-2.383 1.516-6.728 4.448-.636.437-1.213.65-1.729.638-.57-.012-1.666-.323-2.483-.588-1.002-.326-1.798-.498-1.729-1.052.036-.288.434-.583 1.194-.886z" 
        fill="#FFFFFF" 
      />
    </svg>
  );
}

/**
 * High-res official Discord Icon
 */
export function DiscordIcon({ size = 20, style = {} }) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      style={{ flexShrink: 0, display: 'block', ...style }}
    >
      <circle cx="12" cy="12" r="12" fill="#5865F2" />
      <g transform="translate(3.6, 3.6) scale(0.7)">
        <path 
          d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.894.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" 
          fill="#FFFFFF" 
        />
      </g>
    </svg>
  );
}

export default function CommunityPopover({ isOpen, onClose, anchorRef, onShowToast }) {
  const popoverRef = useRef(null);

  // Close on outside click or escape key
  useEffect(() => {
    if (!isOpen) return;

    let cleanup = null;
    const timerId = setTimeout(() => {
      const handleOutsideClick = (e) => {
        if (
          popoverRef.current &&
          !popoverRef.current.contains(e.target) &&
          anchorRef?.current &&
          !anchorRef.current.contains(e.target)
        ) {
          onClose();
        }
      };

      const handleKeyDown = (e) => {
        if (e.key === 'Escape') {
          onClose();
        }
      };

      document.addEventListener('pointerdown', handleOutsideClick);
      document.addEventListener('keydown', handleKeyDown);

      cleanup = () => {
        document.removeEventListener('pointerdown', handleOutsideClick);
        document.removeEventListener('keydown', handleKeyDown);
      };
    }, 10);

    return () => {
      clearTimeout(timerId);
      if (cleanup) cleanup();
    };
  }, [isOpen, onClose, anchorRef]);

  if (!isOpen) return null;

  const handleOpenLink = (platform) => {
    const url = COMMUNITY_LINKS[platform];
    if (url && url.trim() && url !== '#') {
      window.open(url, '_blank', 'noopener,noreferrer');
      onClose();
    } else {
      if (onShowToast) {
        onShowToast({
          title: `${platform === 'telegram' ? 'Telegram' : 'Discord'} Community`,
          message: `${platform === 'telegram' ? 'Telegram' : 'Discord'} community link will be updated soon!`,
          type: 'info'
        });
      }
      onClose();
    }
  };

  return (
    <div
      ref={popoverRef}
      style={{
        position: 'absolute',
        top: 'calc(100% + 8px)',
        right: '-24px',
        zIndex: 1100,
        display: 'flex',
        alignItems: 'center',
        backgroundColor: 'var(--bg-card, #ffffff)',
        border: '1px solid var(--border-color, rgba(0, 0, 0, 0.08))',
        borderRadius: '9999px',
        padding: '4px 6px',
        gap: '4px',
        boxShadow: '0 12px 30px -4px rgba(0, 0, 0, 0.3), 0 4px 10px -2px rgba(0, 0, 0, 0.15)',
        animation: 'communityPopIn 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
        userSelect: 'none',
        whiteSpace: 'nowrap'
      }}
    >
      {/* Aesthetic Pointer arrow pointing up to the Community button */}
      <div 
        style={{
          position: 'absolute',
          top: '-5px',
          right: '31px',
          width: '9px',
          height: '9px',
          backgroundColor: 'var(--bg-card, #ffffff)',
          borderTop: '1px solid var(--border-color, rgba(0, 0, 0, 0.08))',
          borderLeft: '1px solid var(--border-color, rgba(0, 0, 0, 0.08))',
          transform: 'rotate(45deg)',
          zIndex: 1,
          pointerEvents: 'none'
        }} 
      />

      {/* Telegram Option Button */}
      <button
        type="button"
        onClick={() => handleOpenLink('telegram')}
        title="Join FoxTrade Telegram Community"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 14px',
          backgroundColor: 'transparent',
          border: 'none',
          borderRadius: '9999px',
          cursor: 'pointer',
          transition: 'all 0.16s ease',
          color: 'var(--text-primary, #1e293b)',
          fontSize: '13px',
          fontWeight: 600,
          outline: 'none',
          zIndex: 2
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'rgba(2, 132, 199, 0.12)';
          e.currentTarget.style.color = '#0284c7';
          e.currentTarget.style.transform = 'translateY(-1px)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'transparent';
          e.currentTarget.style.color = 'var(--text-primary, #1e293b)';
          e.currentTarget.style.transform = 'translateY(0)';
        }}
      >
        <TelegramIcon size={20} />
        <span>Telegram</span>
      </button>

      {/* Vertical Aesthetic Divider */}
      <div 
        style={{
          width: '1px',
          height: '18px',
          backgroundColor: 'var(--border-color, #e2e8f0)',
          margin: '0 2px',
          zIndex: 2
        }} 
      />

      {/* Discord Option Button */}
      <button
        type="button"
        onClick={() => handleOpenLink('discord')}
        title="Join FoxTrade Discord Community"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 14px',
          backgroundColor: 'transparent',
          border: 'none',
          borderRadius: '9999px',
          cursor: 'pointer',
          transition: 'all 0.16s ease',
          color: 'var(--text-primary, #1e293b)',
          fontSize: '13px',
          fontWeight: 600,
          outline: 'none',
          zIndex: 2
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'rgba(88, 101, 242, 0.12)';
          e.currentTarget.style.color = '#5865f2';
          e.currentTarget.style.transform = 'translateY(-1px)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'transparent';
          e.currentTarget.style.color = 'var(--text-primary, #1e293b)';
          e.currentTarget.style.transform = 'translateY(0)';
        }}
      >
        <DiscordIcon size={20} />
        <span>Discord</span>
      </button>
    </div>
  );
}
