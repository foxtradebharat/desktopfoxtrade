import React, { useState, useEffect, Component, Suspense, lazy } from 'react';
import LoginPage from './pages/LoginPage';
import DashboardSkeleton from './components/DashboardSkeleton';
import TitleBar from './components/TitleBar';
import UpdateModal from './components/UpdateModal';
import { loginWithGoogle, logoutUser, subscribeToAuth, signInWithGoogleIdToken } from './services/firebase';
import { clearTokens } from './db/tokenManager';

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
  const [accessToken, setAccessToken] = useState(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);

  // OS-aware system theme detection and live listener for Electron
  useEffect(() => {
    if (typeof window !== 'undefined' && window.electronAPI?.theme) {
      window.electronAPI.theme.getSystemTheme().then(res => {
        const userTheme = localStorage.getItem('tradeontip_theme');
        if (!userTheme) {
          if (res?.isDark) {
            document.documentElement.classList.add('dark');
            document.body.classList.add('dark');
            document.documentElement.setAttribute('data-theme', 'dark');
          } else {
            document.documentElement.classList.remove('dark');
            document.body.classList.remove('dark');
            document.documentElement.removeAttribute('data-theme');
          }
        }
      }).catch(() => {});

      const unsub = window.electronAPI.theme.onSystemThemeChange(res => {
        const userTheme = localStorage.getItem('tradeontip_theme');
        if (!userTheme) {
          if (res?.isDark) {
            document.documentElement.classList.add('dark');
            document.body.classList.add('dark');
            document.documentElement.setAttribute('data-theme', 'dark');
          } else {
            document.documentElement.classList.remove('dark');
            document.body.classList.remove('dark');
            document.documentElement.removeAttribute('data-theme');
          }
        }
      });
      return () => {
        if (unsub) unsub();
      };
    }
  }, []);

  // Listen to menu:check-updates events across all pages
  useEffect(() => {
    const handleCheckUpdates = () => setShowUpdateModal(true);
    window.addEventListener('menu:check-updates', handleCheckUpdates);
    return () => window.removeEventListener('menu:check-updates', handleCheckUpdates);
  }, []);

  // Background prefetch Dashboard chunk once login page is displayed
  useEffect(() => {
    const prefetchTimer = setTimeout(() => {
      import('./Dashboard').catch(() => {});
    }, 1000);
    return () => clearTimeout(prefetchTimer);
  }, []);

  // Safe navigation helper supporting both web pushState and Electron file:// hash routes
  const navigateSafe = (path, replace = false) => {
    try {
      if (typeof window === 'undefined') return;
      if (window.location.protocol === 'file:') {
        const hash = path === '/' ? '#/' : `#${path.replace(/^\//, '')}`;
        if (replace) {
          if (window.history && window.history.replaceState) {
            window.history.replaceState(null, '', hash);
          } else {
            window.location.hash = hash;
          }
        } else {
          if (window.history && window.history.pushState) {
            window.history.pushState(null, '', hash);
          } else {
            window.location.hash = hash;
          }
        }
        return;
      }

      if (replace) {
        window.history.replaceState(null, '', path);
      } else {
        window.history.pushState({}, '', path);
      }
    } catch (e) {
      console.warn('[App] Navigation error:', e);
    }
  };

  const isLandingPath = () => {
    try {
      const sp = new URLSearchParams(window.location.search);
      const isFile = window.location.protocol === 'file:';
      const hash = (window.location.hash || '').toLowerCase();
      return sp.get('landing') === 'true' || 
             (isFile ? hash.includes('landing') : window.location.pathname === '/landing');
    } catch {
      return false;
    }
  };

  // Check if landing page is explicitly requested via query param or path
  const [showLanding, setShowLanding] = useState(isLandingPath);

  useEffect(() => {
    const checkUrl = () => setShowLanding(isLandingPath());
    window.addEventListener('popstate', checkUrl);
    window.addEventListener('hashchange', checkUrl);
    return () => {
      window.removeEventListener('popstate', checkUrl);
      window.removeEventListener('hashchange', checkUrl);
    };
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
        if (typeof window !== 'undefined' && window.electronAPI?.db?.setSetting) {
          window.electronAPI.db.setSetting('active_user', JSON.stringify(u)).catch(() => {});
        }
        setAuthError(null);
        getValidAccessToken().then(tok => {
          if (tok) setAccessToken(tok);
        }).catch(() => {});
        if (window.location.search.includes('landing=true')) {
          navigateSafe('/');
          setShowLanding(false);
        }
      } else {
        const savedUserStr = localStorage.getItem('tradeontip_user');
        if (savedUserStr) {
          try {
            const parsed = JSON.parse(savedUserStr);
            if (parsed && parsed.uid) {
              setUser(parsed);
              getValidAccessToken().then(tok => {
                if (tok) setAccessToken(tok);
              }).catch(() => {});
            } else {
              setUser(null);
            }
          } catch (_) {
            setUser(null);
          }
        } else {
          setUser(null);
          localStorage.removeItem('tradeontip_token');
          localStorage.removeItem('tradeontip_token_expiry');
        }
      }
      setAuthChecking(false);
    });

    // Fallback: restore active session from SQLite database if running in Electron
    if (typeof window !== 'undefined' && window.electronAPI?.db?.getSetting) {
      window.electronAPI.db.getSetting('active_user', null).then(dbUserStr => {
        if (dbUserStr) {
          try {
            const parsed = JSON.parse(dbUserStr);
            if (parsed && parsed.uid) {
              setUser(prev => prev || parsed);
              localStorage.setItem('tradeontip_user', dbUserStr);
            }
          } catch (_) {}
        }
      }).catch(() => {});
    }

    const timeout = setTimeout(() => {
      setAuthChecking(false);
    }, 2500);

    return () => {
      unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  // Listen for browser-based OAuth success event from Electron (loopback flow)
  useEffect(() => {
    const handleAuthPayload = async (payload) => {
      if (payload?.idToken) {
        try {
          const userCredential = await signInWithGoogleIdToken(payload.idToken);
          if (userCredential) {
            const u = {
              uid: userCredential.uid,
              name: userCredential.displayName || 'Trader',
              email: userCredential.email,
              photoURL: userCredential.photoURL || null,
            };
            setUser(u);
            localStorage.setItem('tradeontip_user', JSON.stringify(u));
            setAuthLoading(false);
            setAuthError(null);
            navigateSafe('/');
            setShowLanding(false);
            return;
          }
        } catch (credErr) {
          console.warn('[Desktop Auth] signInWithGoogleIdToken fallback:', credErr);
        }
      }
      if (payload?.user) {
        const u = {
          uid: payload.user.uid,
          name: payload.user.displayName || payload.user.name || 'Trader',
          email: payload.user.email,
          photoURL: payload.user.photoURL || null,
        };
        setUser(u);
        localStorage.setItem('tradeontip_user', JSON.stringify(u));
        setAuthLoading(false);
        setAuthError(null);
        navigateSafe('/');
        setShowLanding(false);
      } else if (payload?.error) {
        setAuthError(payload.error);
        setAuthLoading(false);
      }
    };

    if (typeof window !== 'undefined') {
      if (window.desktopAuth?.onResult) {
        return window.desktopAuth.onResult(handleAuthPayload);
      } else if (window.electronAPI?.auth?.onBrowserSuccess) {
        return window.electronAPI.auth.onBrowserSuccess(handleAuthPayload);
      }
    }
  }, []);

  // Sync unauthenticated visitors to /login and authenticated users away from /login
  useEffect(() => {
    if (authChecking) return;
    if (!user) {
      if (window.location.protocol !== 'file:' && window.location.pathname === '/' && !showLanding) {
        navigateSafe('/login', true);
      }
    } else {
      if (window.location.pathname === '/login' || window.location.hash === '#/login' || window.location.hash === '#login') {
        navigateSafe('/', true);
      }
    }
  }, [user, authChecking, showLanding]);

  const handleGoogleLogin = async (emailHint) => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      // In Electron Desktop, delegate authentication to the system default browser via loopback flow
      const isElectron = typeof window !== 'undefined' && Boolean(window.desktopAuth?.startGoogleLogin || window.electronAPI?.auth?.startBrowserLogin);
      if (isElectron) {
        const startLogin = window.desktopAuth?.startGoogleLogin || window.electronAPI?.auth?.startBrowserLogin;
        const res = await startLogin();
        if (res?.idToken) {
          try {
            const userCredential = await signInWithGoogleIdToken(res.idToken);
            if (userCredential) {
              const u = {
                uid: userCredential.uid,
                name: userCredential.displayName || 'Trader',
                email: userCredential.email,
                photoURL: userCredential.photoURL || null,
              };
              setUser(u);
              localStorage.setItem('tradeontip_user', JSON.stringify(u));
              navigateSafe('/');
              setShowLanding(false);
              return { user: u };
            }
          } catch (credErr) {
            console.warn('[Desktop Auth] signInWithCredential failed, using payload fallback:', credErr);
          }
        }

        if (res?.user) {
          const u = {
            uid: res.user.uid,
            name: res.user.displayName || res.user.name || 'Trader',
            email: res.user.email,
            photoURL: res.user.photoURL || null,
          };
          setUser(u);
          localStorage.setItem('tradeontip_user', JSON.stringify(u));
          navigateSafe('/');
          setShowLanding(false);
          return { user: u };
        } else if (res?.error) {
          setAuthError(res.error);
          return null;
        }
        return null;
      }

      // Web browser flow
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

        // Direct transition into dashboard
        navigateSafe('/');
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
    setUser(null);
    setAccessToken(null);
    setAuthError(null);
    localStorage.removeItem('tradeontip_user');
    localStorage.removeItem('tradeontip_token');
    localStorage.removeItem('tradeontip_token_expiry');
    if (typeof window !== 'undefined' && window.electronAPI?.db?.deleteSetting) {
      window.electronAPI.db.deleteSetting('active_user').catch(() => {});
    }
    navigateSafe('/login');
  };

  // ── Render Page Content ──────────────────────────────────────────────────
  const renderContent = () => {
    if (authChecking) {
      return <DashboardSkeleton />;
    }

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
                navigateSafe('/');
                setShowLanding(false);
              }}
            />
          </Suspense>
        </ErrorBoundary>
      );
    }

    if (!user) {
      return (
        <ErrorBoundary>
          <LoginPage
            onGoogleLogin={handleGoogleLogin}
            isLoading={authLoading}
            authError={authError}
            user={user}
            onGoToDashboard={() => {
              navigateSafe('/');
              setShowLanding(false);
            }}
          />
        </ErrorBoundary>
      );
    }

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
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw', overflow: 'hidden' }}>
      <TitleBar 
        onOpenUpdateModal={() => setShowUpdateModal(true)}
        onOpenSettings={() => window.dispatchEvent(new CustomEvent('menu:open-settings'))}
        onNewTrade={() => window.dispatchEvent(new CustomEvent('menu:new-trade'))}
        onImportTrades={() => window.dispatchEvent(new CustomEvent('menu:import-trades'))}
        onToggleTheme={() => window.dispatchEvent(new CustomEvent('menu:toggle-theme'))}
      />
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
        {renderContent()}
      </div>
      <UpdateModal 
        isOpen={showUpdateModal} 
        onClose={() => setShowUpdateModal(false)} 
      />
    </div>
  );
}
