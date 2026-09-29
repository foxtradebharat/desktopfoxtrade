import React, { useState } from 'react';
import foxtradeLockup from '../assets/logo/foxtrade-lockup-transparent.png';
import { Globe, HelpCircle, KeyRound, Building2 } from 'lucide-react';
import { usePageTitle } from '../hooks/usePageTitle';

// ── Google Multi-color SVG Icon ───────────────────────────────────────────────
function GoogleIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
    </svg>
  );
}

// ── Apple SVG Icon ────────────────────────────────────────────────────────────
function AppleIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 170 170" fill="currentColor">
      <path d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.75 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.35.13-9.16-1.9-14.42-6.08-3.7-3.04-7.7-7.85-12.01-14.42-6.53-9.92-11.75-20.73-15.66-32.44-3.92-11.71-5.88-22.78-5.88-33.22 0-14.67 3.8-26.68 11.41-36.03 7.61-9.35 17.06-14.16 28.34-14.42 4.9.11 10.12 1.34 15.66 3.71 5.54 2.37 9.17 3.55 10.88 3.55 1.52 0 5.43-1.28 11.74-3.84 6.3-2.56 11.83-3.74 16.58-3.55 12.63.65 22.84 5.34 30.63 14.07-11.09 6.74-16.52 15.98-16.3 27.72.22 9.13 3.69 16.85 10.42 23.16 6.74 6.3 14.67 9.89 23.81 10.76-2.39 7.4-5.34 14.78-8.86 22.15zM119.22 33.02c0-7.39 2.61-14.24 7.83-20.55 5.22-6.3 11.74-10.22 19.57-11.74.22 1.09.33 2.17.33 3.26 0 7.17-2.72 14.13-8.15 20.87-5.44 6.74-12.07 10.76-19.9 12.07-.11-1.3-.11-2.4-.11-3.48z" />
    </svg>
  );
}

// ── Microsoft SVG Icon ────────────────────────────────────────────────────────
function MicrosoftIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 21 21">
      <rect x="1" y="1" width="9" height="9" fill="#f25022"/>
      <rect x="11" y="1" width="9" height="9" fill="#7fba00"/>
      <rect x="1" y="11" width="9" height="9" fill="#00a4ef"/>
      <rect x="11" y="11" width="9" height="9" fill="#ffb900"/>
    </svg>
  );
}

// ── Passkey SVG Icon ──────────────────────────────────────────────────────────
function PasskeyIcon() {
  return (
    <KeyRound size={22} strokeWidth={1.75} color="currentColor" />
  );
}

// ── SSO SVG Icon ──────────────────────────────────────────────────────────────
function SsoIcon() {
  return (
    <Building2 size={22} strokeWidth={1.75} color="currentColor" />
  );
}

// ── Notion-style Social Tile ──────────────────────────────────────────────────
function SocialTile({ icon, label, onClick, width = null, isLoading = false }) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isLoading}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '4px',
        height: '72px',
        width: width || 'auto',
        flex: width ? 'none' : '1 1 0%',
        minWidth: 0,
        borderRadius: '6px',
        backgroundColor: hovered ? 'var(--bg-hover, rgba(0, 0, 0, 0.03))' : 'transparent',
        boxShadow: hovered
          ? 'rgba(0, 0, 0, 0.06) 0px 3px 6px 0px, rgba(42, 28, 0, 0.12) 0px 0px 0px 1px'
          : 'rgba(0, 0, 0, 0.04) 0px 2px 4px 0px, rgba(42, 28, 0, 0.07) 0px 0px 0px 1px',
        cursor: isLoading ? 'wait' : 'pointer',
        transition: 'background-color 0.15s ease, box-shadow 0.15s ease, transform 0.1s ease',
        transform: hovered && !isLoading ? 'translateY(-1px)' : 'translateY(0)',
        color: 'var(--text-primary, #37352f)',
        fontSize: '12px',
        fontWeight: 500,
        border: 'none',
        outline: 'none',
        padding: '8px',
        userSelect: 'none',
        opacity: isLoading ? 0.7 : 1,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '26px' }}>
        {isLoading ? (
          <div style={{
            width: '18px',
            height: '18px',
            border: '2px solid rgba(0,0,0,0.15)',
            borderTopColor: '#2383e2',
            borderRadius: '50%',
            animation: 'loginSpinner 0.8s linear infinite'
          }} />
        ) : (
          icon
        )}
      </div>
      <span style={{ lineHeight: '14px' }}>
        {isLoading ? 'Connecting…' : label}
      </span>
    </button>
  );
}

export default function LoginPage({ onGoogleLogin, isLoading, authError, user, onGoToDashboard }) {
  usePageTitle('Log in');
  const [email, setEmail] = useState('');
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [continueHover, setContinueHover] = useState(false);
  const [toastMsg, setToastMsg] = useState(null);

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3800);
  };

  const handleContinue = (overrideEmail) => {
    const targetEmail = overrideEmail !== undefined ? overrideEmail : email.trim();
    if (onGoogleLogin) {
      onGoogleLogin(targetEmail || undefined);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: 'var(--bg-primary, #ffffff)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
      padding: '40px 20px',
      position: 'relative',
      boxSizing: 'border-box',
    }}>
      <style>{`
        @keyframes loginSpinner {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>

      {/* Toast alert if non-Google provider clicked */}
      {toastMsg && (
        <div style={{
          position: 'fixed',
          top: '24px',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: '#111827',
          color: '#ffffff',
          padding: '10px 18px',
          borderRadius: '8px',
          fontSize: '13px',
          fontWeight: 500,
          boxShadow: '0 10px 25px rgba(0,0,0,0.18)',
          zIndex: 9999,
          animation: 'fadeIn 0.2s ease',
          maxWidth: '90%',
          textAlign: 'center'
        }}>
          {toastMsg}
        </div>
      )}

      {/* Main Centered Login Container (Notion 380px) */}
      <div style={{
        width: '100%',
        maxWidth: '380px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
      }}>

        {/* Top Logo Lockup */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '24px',
        }}>
          <a 
            href="https://foxtrade.in"
            title="Go to FoxTrade Home"
            style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}
          >
            <img
              src={foxtradeLockup}
              alt="FoxTrade"
              style={{
                height: '64px',
                width: 'auto',
                objectFit: 'contain',
                filter: 'var(--foxtrade-logo-filter, none)',
                userSelect: 'none',
              }}
            />
          </a>
        </div>

        {/* Headings */}
        <h1 style={{
          fontWeight: 700,
          fontSize: '23px',
          lineHeight: '28px',
          color: 'var(--text-primary, #040404)',
          margin: 0,
          letterSpacing: '-0.3px',
        }}>
          Your Trading Journal.
        </h1>
        <h2 style={{
          fontWeight: 600,
          fontSize: '22px',
          lineHeight: '26px',
          color: 'var(--text-muted, #787774)',
          margin: '0 0 28px 0',
          letterSpacing: '-0.3px',
        }}>
          Log in to your FoxTrade account
        </h2>

        {/* If user is already authenticated (e.g. testing view) */}
        {user && onGoToDashboard && (
          <div style={{
            width: '100%',
            backgroundColor: 'var(--bg-surface, #f8f9fa)',
            border: '1px solid var(--border-color, #e5e7eb)',
            borderRadius: '8px',
            padding: '12px 16px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px'
          }}>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary, #111827)' }}>
                Active Session: {user.name || 'Trader'}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted, #6b7280)' }}>
                {user.email}
              </div>
            </div>
            <button
              onClick={onGoToDashboard}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                backgroundColor: '#111827',
                color: '#ffffff',
                fontSize: '12px',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer'
              }}
            >
              Open App →
            </button>
          </div>
        )}

        {/* Auth Error Banner if present */}
        {authError && (
          <div style={{
            width: '100%',
            backgroundColor: '#fef2f2',
            border: '1px solid #fee2e2',
            color: '#b91c1c',
            padding: '10px 14px',
            borderRadius: '8px',
            fontSize: '12.5px',
            lineHeight: '1.45',
            marginBottom: '18px',
            textAlign: 'left'
          }}>
            <strong>Sign-in Error:</strong> {authError}
          </div>
        )}

        {/* Email Input Field Form */}
        <div style={{ width: '100%' }}>
          <label 
            htmlFor="login-email-input"
            style={{
              fontSize: '12px',
              lineHeight: '16px',
              display: 'block',
              marginBottom: '6px',
              color: 'var(--text-secondary, #787774)',
              fontWeight: 500,
              textAlign: 'left',
              width: '100%',
            }}
          >
            Email
          </label>

          <div style={{
            width: '100%',
            height: '40px',
            borderRadius: '8px',
            boxShadow: isInputFocused 
              ? '0 0 0 2px #2383e2, 0 1px 2px rgba(35, 131, 226, 0.15)' 
              : 'rgba(15, 15, 15, 0.12) 0px 0px 0px 1px, rgba(15, 15, 15, 0.05) 0px 1px 2px 0px',
            backgroundColor: 'var(--bg-surface, transparent)',
            display: 'flex',
            alignItems: 'center',
            padding: '0 14px',
            transition: 'box-shadow 0.15s ease',
            boxSizing: 'border-box'
          }}>
            <input
              id="login-email-input"
              name="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onFocus={() => setIsInputFocused(true)}
              onBlur={() => setIsInputFocused(false)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleContinue();
              }}
              placeholder="Enter your email address..."
              style={{
                width: '100%',
                height: '100%',
                border: 'none',
                outline: 'none',
                background: 'transparent',
                fontSize: '14.5px',
                color: 'var(--text-primary, #040404)',
                fontFamily: 'inherit',
              }}
            />
          </div>

          <div style={{
            color: 'var(--text-muted, #9b9a97)',
            fontSize: '12px',
            lineHeight: '16px',
            marginTop: '6px',
            marginBottom: '16px',
            textAlign: 'left',
            width: '100%',
          }}>
            Use an organization or personal email to easily collaborate with teammates
          </div>

          {/* Continue Button */}
          <button
            type="button"
            onClick={handleContinue}
            disabled={isLoading}
            onMouseEnter={() => setContinueHover(true)}
            onMouseLeave={() => setContinueHover(false)}
            style={{
              width: '100%',
              height: '40px',
              borderRadius: '8px',
              background: continueHover 
                ? 'linear-gradient(rgba(0, 0, 0, 0.05) 0%, rgba(0, 0, 0, 0.1) 100%), rgb(30, 118, 207)'
                : 'linear-gradient(rgba(0, 0, 0, 0) 0%, rgba(0, 0, 0, 0.05) 100%), rgb(35, 131, 226)',
              boxShadow: 'rgba(15, 15, 15, 0.1) 0px 0px 0px 1px inset, rgba(15, 15, 15, 0.1) 0px 1px 2px 0px',
              color: '#ffffff',
              fontSize: '14px',
              fontWeight: 500,
              border: 'none',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background-color 0.15s ease',
              opacity: isLoading ? 0.7 : 1,
            }}
          >
            {isLoading ? 'Connecting…' : 'Continue'}
          </button>
        </div>

        {/* Divider: or continue with */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          width: '100%',
          margin: '22px 0 18px',
          gap: '12px'
        }}>
          <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border-color, rgba(15, 15, 15, 0.09))' }} />
          <span style={{ fontSize: '13px', color: 'var(--text-muted, #9b9a97)', fontWeight: 400 }}>
            or continue with
          </span>
          <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border-color, rgba(15, 15, 15, 0.09))' }} />
        </div>

        {/* Social Login Tiles Grid (Row 1: 3 tiles, Row 2: 2 tiles) */}
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {/* Row 1: Google, Apple, Microsoft */}
          <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
            <SocialTile 
              icon={<GoogleIcon />} 
              label="Google" 
              onClick={() => handleContinue()} 
              isLoading={isLoading}
            />
            <SocialTile 
              icon={<AppleIcon />} 
              label="Apple" 
              onClick={() => showToast("FoxTrade uses your Google Drive for private storage. Click Google to continue.")} 
            />
            <SocialTile 
              icon={<MicrosoftIcon />} 
              label="Microsoft" 
              onClick={() => showToast("FoxTrade uses your Google Drive for private storage. Click Google to continue.")} 
            />
          </div>

          {/* Row 2: Passkey, SSO (centered) */}
          <div style={{ display: 'flex', gap: '8px', width: '100%', justifyContent: 'center' }}>
            <SocialTile 
              icon={<PasskeyIcon />} 
              label="Passkey" 
              width="112px"
              onClick={() => showToast("Passkeys will be available in the upcoming mobile release. Please continue with Google.")} 
            />
            <SocialTile 
              icon={<SsoIcon />} 
              label="SSO" 
              width="112px"
              onClick={() => showToast("Enterprise SSO is supported via Google Workspace. Please continue with Google.")} 
            />
          </div>
        </div>

        {/* New user? Sign up */}
        <div style={{ marginTop: '22px', fontSize: '13.5px', color: 'var(--text-muted, #787774)' }}>
          New user?{' '}
          <button
            type="button"
            onClick={handleContinue}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              color: '#2383e2',
              fontSize: '13.5px',
              fontWeight: 500,
              cursor: 'pointer',
              textDecoration: 'none'
            }}
            onMouseEnter={(e) => e.currentTarget.style.textDecoration = 'underline'}
            onMouseLeave={(e) => e.currentTarget.style.textDecoration = 'none'}
          >
            Sign up
          </button>
        </div>

        {/* Terms & Privacy Note */}
        <p style={{
          marginTop: '32px',
          marginBottom: 0,
          fontSize: '11px',
          lineHeight: '16px',
          color: 'var(--text-muted, #9b9a97)',
          maxWidth: '340px',
          textAlign: 'center'
        }}>
          By continuing, you acknowledge that you understand and agree to the{' '}
          <a 
            href="https://foxtrade.in/terms" 
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--text-secondary, #787774)', textDecoration: 'underline' }}
          >
            Terms &amp; Conditions
          </a>
          {' '}and{' '}
          <a 
            href="https://foxtrade.in/privacy" 
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--text-secondary, #787774)', textDecoration: 'underline' }}
          >
            Privacy Policy
          </a>
        </p>

      </div>

      {/* Bottom Corner Controls: Language & Help */}
      <div style={{
        position: 'fixed',
        bottom: '12px',
        left: '16px',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        color: 'var(--text-muted, #9b9a97)',
        fontSize: '12px',
        cursor: 'pointer',
        padding: '4px 8px',
        borderRadius: '6px',
        transition: 'background-color 0.15s ease',
      }}
      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-hover, rgba(0,0,0,0.04))'}
      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
      >
        <Globe size={14} />
        <span>Language: English (US) ▾</span>
      </div>

      <div style={{
        position: 'fixed',
        bottom: '12px',
        right: '16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '30px',
        height: '30px',
        borderRadius: '50%',
        color: 'var(--text-muted, #787774)',
        cursor: 'pointer',
        transition: 'background-color 0.15s ease',
      }}
      title="Help & Support"
      onClick={() => showToast("Need help? Support is available at support@foxtrade.in")}
      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-hover, rgba(0,0,0,0.04))'}
      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
      >
        <HelpCircle size={18} />
      </div>

    </div>
  );
}
