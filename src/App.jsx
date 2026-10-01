import React, { useState, useEffect, Component, Suspense, lazy } from 'react';
import LoginPage from './pages/LoginPage';
import DashboardSkeleton from './components/DashboardSkeleton';
import { loginWithGoogle, logoutUser, subscribeToAuth } from './services/firebase';
import { storeDirectToken, clearTokens } from './db/tokenManager';
import { setSyncError } from './db/index';
import { clearAllLocalTrades } from './services/dbService';

const LandingPage = lazy(() => import('./pages/LandingPage'));
const Dashboard = lazy(() => import('./Dashboard'));

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[TradeOnTip Error Boundary caught an error]:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#f9fafb',
          fontFamily: 'Inter, system-ui, sans-serif',
          padding: '24px',
          textAlign: 'center'
        }}>
          <div style={{
            maxWidth: '500px',
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            padding: '32px',
            border: '1px solid #e5e7eb',
            boxShadow: '0 10px 25px rgba(0,0,0,0.05)'
          }}>
            <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#111827', marginBottom: '8px' }}>
              Something went wrong
            </h2>
            <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '20px', lineHeight: 1.5 }}>
              {this.state.error?.message || 'An unexpected rendering error occurred.'}
            </p>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              style={{
                padding: '10px 20px',
                borderRadius: '10px',
                border: 'none',
                backgroundColor: '#111827',
                color: '#ffffff',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Reload FoxTrade
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('tradeontip_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [accessToken, setAccessToken] = useState(() => {
    try {
      const tok = localStorage.getItem('tradeontip_token');
      const exp = localStorage.getItem('tradeontip_token_expiry');
      if (!tok) return null;
      if (!exp || Date.now() >= Number(exp)) {
        console.warn('[App] Stored Google Drive token is missing expiry or expired, clearing stale token.');
        localStorage.removeItem('tradeontip_token');
        localStorage.removeItem('tradeontip_token_expiry');
        return null;
      }
      return tok;
    } catch {
      return null;
    }
  });

  const [authChecking, setAuthChecking] = useState(() => {
    try {
      // If directly visiting /login or root without saved session, load login immediately with 0 delay!
      if (typeof window !== 'undefined' && (window.location.pathname === '/login' || window.location.pathname === '/')) {
        return false;
      }
      const saved = localStorage.getItem('tradeontip_user');
      return !saved ? false : false;
    } catch {
      return false;
    }
  });
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState(null);

  // Background prefetch Dashboard chunk once login page is displayed
  useEffect(() => {
    const prefetchTimer = setTimeout(() => {
      import('./Dashboard').catch(() => {});
    }, 1000);
    return () => clearTimeout(prefetchTimer);
  }, []);

  // Check if landing page is explicitly requested via query param or path
  const [showLanding, setShowLanding] = useState(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      return sp.get('landing') === 'true' || window.location.pathname === '/landing';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const checkUrl = () => {
      const sp = new URLSearchParams(window.location.search);
      setShowLanding(sp.get('landing') === 'true' || window.location.pathname === '/landing');
    };
    window.addEventListener('popstate', checkUrl);
    return () => window.removeEventListener('popstate', checkUrl);
  }, []);

  // Subscribe to Firebase Auth state on mount
  useEffect(() => {
    const unsubscribe = subscribeToAuth((fbUser) => {
      if (fbUser) {
        const u = {
          uid: fbUser.uid,
          name: fbUser.displayName || 'Trader',
          email: fbUser.email,
          photoURL: fbUser.photoURL,
        };
        setUser(u);
        localStorage.setItem('tradeontip_user', JSON.stringify(u));
        setAuthError(null);
        if (window.location.search.includes('landing=true')) {
          window.history.pushState({}, '', '/');
          setShowLanding(false);
        }
      } else {
        setUser(null);
        localStorage.removeItem('tradeontip_user');
        localStorage.removeItem('tradeontip_token');
        localStorage.removeItem('tradeontip_token_expiry');
      }
      setAuthChecking(false);
    });

    const timeout = setTimeout(() => {
      setAuthChecking(false);
    }, 2500);

    return () => {
      unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  // Sync unauthenticated visitors to /login and authenticated users away from /login
  useEffect(() => {
    if (authChecking) return;
    if (!user) {
      if (window.location.pathname === '/' && !showLanding) {
        window.history.replaceState(null, '', '/login');
      }
    } else {
      if (window.location.pathname === '/login') {
        window.history.replaceState(null, '', '/');
      }
    }
  }, [user, authChecking, showLanding]);

  const handleGoogleLogin = async (emailHint) => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      const res = await loginWithGoogle(emailHint);
      if (res && res.user) {
        const u = {
          uid: res.user.uid,
          name: res.user.displayName || 'Trader',
          email: res.user.email,
          photoURL: res.user.photoURL,
        };
        setUser(u);
        localStorage.setItem('tradeontip_user', JSON.stringify(u));
        if (res.accessToken) {
          setAccessToken(res.accessToken);
          localStorage.setItem('tradeontip_token', res.accessToken);
          localStorage.setItem('tradeontip_token_expiry', String(Date.now() + 3500 * 1000));
          await storeDirectToken(res.accessToken, res.user.email).catch(() => {});
          setSyncError(null);
        }
        // Direct transition into dashboard
        window.history.pushState({}, '', '/');
        setShowLanding(false);
      }
      return res;
    } catch (err) {
      console.warn('[Google Login Error]:', err.code, err.message);
      let msg = err.message || 'Google Sign-In failed.';
      if (err.code === 'auth/unauthorized-domain') {
        msg = 'This domain is not authorized in your Firebase Console. Go to Firebase Console -> Authentication -> Settings -> Authorized Domains and add localhost or your domain.';
      } else if (err.code === 'auth/popup-blocked') {
        msg = 'Pop-up window was blocked by your browser. Please allow popups for this site and try again.';
      } else if (err.code === 'auth/popup-closed-by-user') {
        msg = 'Sign-in window was closed before completion.';
      }
      setAuthError(msg);
      return null;
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    await logoutUser();
    await clearTokens().catch(() => {});
    await clearAllLocalTrades().catch(() => {});
    setUser(null);
    setAccessToken(null);
    setAuthError(null);
    localStorage.removeItem('tradeontip_user');
    localStorage.removeItem('tradeontip_token');
    localStorage.removeItem('tradeontip_token_expiry');
    try {
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('tradeontip_trades_') || key.startsWith('foxtrade_trades_') || key === 'tradeontip_trades_cache') {
          localStorage.removeItem(key);
        }
      });
    } catch (_) {}
    window.history.pushState(null, '', '/login');
  };

  // ── 1. Sleek shimmer skeleton screen while checking initial session ─────────
  if (authChecking) {
    return <DashboardSkeleton />;
  }

  // ── 2. Show Landing Page if explicitly requested ─────────────────────────
  if (showLanding) {
    return (
      <ErrorBoundary>
        <Suspense fallback={<DashboardSkeleton />}>
          <LandingPage
            onGoogleLogin={handleGoogleLogin}
            isLoading={authLoading}
            authError={authError}
            user={user}
            onGoToDashboard={() => {
              window.history.pushState({}, '', '/');
              setShowLanding(false);
            }}
          />
        </Suspense>
      </ErrorBoundary>
    );
  }

  // ── 3. Show Notion-style Login Page if unauthenticated (Loaded Instantly) ──
  if (!user) {
    return (
      <ErrorBoundary>
        <LoginPage
          onGoogleLogin={handleGoogleLogin}
          isLoading={authLoading}
          authError={authError}
          user={user}
          onGoToDashboard={() => {
            window.history.pushState({}, '', '/');
            setShowLanding(false);
          }}
        />
      </ErrorBoundary>
    );
  }

  // ── 4. Render Dashboard for authenticated user ───────────────────────────
  return (
    <ErrorBoundary>
      <Suspense fallback={<DashboardSkeleton />}>
        <Dashboard 
          user={user} 
          accessToken={accessToken}
          onLogout={handleLogout} 
          onGoogleLogin={handleGoogleLogin}
        />
      </Suspense>
    </ErrorBoundary>
  );
}
