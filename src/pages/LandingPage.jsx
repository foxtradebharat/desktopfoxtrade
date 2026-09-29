import React, { useState } from 'react';
import FoxTradeLogo from '../components/FoxTradeLogo';
import { usePageTitle } from '../hooks/usePageTitle';
import { 
  BarChart2, Folder, Search, Sparkles, Calendar, Receipt, 
  Bot, IndianRupee, Lock, ShieldCheck 
} from 'lucide-react';

// ─── Google G icon (SVG) ──────────────────────────────────────────────────────
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
      <g fill="none" fillRule="evenodd">
        <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
        <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
        <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
        <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
      </g>
    </svg>
  );
}

// ─── Feature pill ─────────────────────────────────────────────────────────────
function FeaturePill({ icon, label }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: '8px',
      padding: '6px 14px', borderRadius: '999px',
      border: '1px solid #e5e7eb', backgroundColor: '#ffffff',
      fontSize: '12px', fontWeight: 500, color: '#374151',
      boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
    }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', color: '#111827' }}>{icon}</span>
      <span>{label}</span>
    </div>
  );
}

// ─── Stat badge ───────────────────────────────────────────────────────────────
function StatBadge({ value, label }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: '28px', fontWeight: 800, color: '#111827', lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px', fontWeight: 500 }}>{label}</div>
    </div>
  );
}

// ─── Main Landing Page ────────────────────────────────────────────────────────
export default function LandingPage({ onGoogleLogin, isLoading, authError, user, onGoToDashboard }) {
  usePageTitle('Institutional Trading Journal for Indian Traders');
  const [hovered, setHovered] = useState(false);

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f8f9fa',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    }}>

      {/* ── Nav bar ── */}
      <nav style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 40px',
        backgroundColor: '#ffffff',
        borderBottom: '1px solid #f3f4f6',
        position: 'sticky', top: 0, zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <FoxTradeLogo size={30} />
          <span style={{ fontWeight: 800, fontSize: '18px', color: '#111827', letterSpacing: '-0.3px' }}>
            FoxTrade
          </span>
          <span style={{ fontSize: '11px', fontWeight: 600, color: '#f97316', backgroundColor: '#fff7ed', padding: '2px 8px', borderRadius: '9999px', border: '1px solid #ffedd5' }}>
            foxtrade.in
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '12px', color: '#9ca3af', fontWeight: 500 }}>
              Your data stays on your Google Drive
            </span>
            <Lock size={14} className="text-gray-400" />
          </div>
          {user && onGoToDashboard && (
            <button
              onClick={onGoToDashboard}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 14px',
                borderRadius: '8px',
                backgroundColor: '#111827',
                color: '#ffffff',
                fontSize: '12.5px',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                transition: 'opacity 0.15s'
              }}
            >
              <span>Go to Journal →</span>
            </button>
          )}
        </div>
      </nav>

      {/* ── Hero ── */}
      <main style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '60px 24px',
        textAlign: 'center',
      }}>

        {/* Tag line chip */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '6px',
          padding: '5px 14px', borderRadius: '999px',
          backgroundColor: '#fff7ed', border: '1px solid #fed7aa',
          fontSize: '12px', fontWeight: 600, color: '#c2410c',
          marginBottom: '28px', letterSpacing: '0.2px',
        }}>
          <span style={{ fontSize: '10px', fontWeight: 800, padding: '1.5px 5px', borderRadius: '4px', backgroundColor: '#fed7aa', color: '#9a3412' }}>IN</span>
          <span>Built for Indian Traders · NSE / BSE / F&O</span>
        </div>

        {/* Auth Error Banner if present */}
        {authError && (
          <div style={{
            maxWidth: '520px',
            width: '100%',
            backgroundColor: '#fef2f2',
            border: '1px solid #fee2e2',
            color: '#b91c1c',
            padding: '12px 16px',
            borderRadius: '12px',
            fontSize: '13px',
            fontWeight: 500,
            marginBottom: '24px',
            textAlign: 'left',
            lineHeight: '1.5'
          }}>
            <strong>Authentication Alert:</strong> {authError}
          </div>
        )}

        {/* Main heading */}
        <h1 style={{
          fontSize: 'clamp(36px, 5vw, 60px)',
          fontWeight: 800,
          color: '#111827',
          lineHeight: 1.1,
          letterSpacing: '-1.5px',
          maxWidth: '720px',
          margin: '0 0 20px',
        }}>
          The Trading Journal<br />
          <span style={{ color: '#f97316' }}>Built for You.</span>
        </h1>

        {/* Sub heading */}
        <p style={{
          fontSize: '17px', color: '#6b7280', lineHeight: 1.65,
          maxWidth: '520px', margin: '0 0 40px', fontWeight: 400,
        }}>
          Track every trade. Spot your patterns. Grow your edge.
          Your data lives in <strong style={{ color: '#111827' }}>your Google Drive</strong> — 
          no servers, no subscriptions, total privacy.
        </p>

        {/* CTA Buttons Container */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center' }}>
            {user && onGoToDashboard ? (
              <button
                onClick={onGoToDashboard}
                onMouseEnter={() => setHovered(true)}
                onMouseLeave={() => setHovered(false)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '10px',
                  padding: '14px 36px',
                  backgroundColor: hovered ? '#1a1a2e' : '#111827',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '12px',
                  fontSize: '15px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  boxShadow: hovered
                    ? '0 8px 30px -6px rgba(0,0,0,0.4)'
                    : '0 4px 14px -4px rgba(0,0,0,0.25)',
                  transform: hovered ? 'translateY(-1px)' : 'translateY(0)',
                  transition: 'all 0.18s ease',
                  letterSpacing: '-0.1px',
                }}
              >
                <span>Launch Trading Journal →</span>
              </button>
            ) : (
              /* Continue with Google */
              <button
                onClick={onGoogleLogin}
                disabled={isLoading}
                onMouseEnter={() => setHovered(true)}
                onMouseLeave={() => setHovered(false)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '12px',
                  padding: '14px 32px',
                  backgroundColor: hovered ? '#1a1a2e' : '#111827',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '12px',
                  fontSize: '15px',
                  fontWeight: 600,
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  boxShadow: hovered
                    ? '0 8px 30px -6px rgba(0,0,0,0.4)'
                    : '0 4px 14px -4px rgba(0,0,0,0.25)',
                  transform: hovered ? 'translateY(-1px)' : 'translateY(0)',
                  transition: 'all 0.18s ease',
                  opacity: isLoading ? 0.7 : 1,
                  letterSpacing: '-0.1px',
                }}
              >
                <div style={{
                  width: '32px', height: '32px', borderRadius: '6px',
                  backgroundColor: '#ffffff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <GoogleIcon />
                </div>
                <span>{isLoading ? 'Connecting…' : 'Continue with Google'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Trust note */}
        <p style={{
          fontSize: '12px', color: '#9ca3af', marginTop: '14px', fontWeight: 400,
        }}>
          No credit card · No password · Your Drive, your data
        </p>


        {/* ── Stats row ── */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '40px',
          marginTop: '56px', padding: '28px 48px',
          backgroundColor: '#ffffff', borderRadius: '16px',
          border: '1px solid #f3f4f6',
          boxShadow: '0 2px 12px -4px rgba(0,0,0,0.08)',
        }}>
          <StatBadge value="2,369+" label="NSE Symbols" />
          <div style={{ width: '1px', height: '36px', backgroundColor: '#f3f4f6' }} />
          <StatBadge value="NSE Live" label="Market Status" />
          <div style={{ width: '1px', height: '36px', backgroundColor: '#f3f4f6' }} />
          <StatBadge value="₹0" label="Your Cost" />
          <div style={{ width: '1px', height: '36px', backgroundColor: '#f3f4f6' }} />
          <StatBadge value="100%" label="Data Privacy" />
        </div>

        {/* ── Feature pills ── */}
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: '10px',
          justifyContent: 'center', marginTop: '36px', maxWidth: '620px',
        }}>
          <FeaturePill icon={<BarChart2 size={14} />} label="Live NSE Market Status" />
          <FeaturePill icon={<Folder size={14} />} label="Google Drive Storage" />
          <FeaturePill icon={<Search size={14} />} label="Trade Analytics" />
          <FeaturePill icon={<Sparkles size={14} />} label="Psychology Tracking" />
          <FeaturePill icon={<Calendar size={14} />} label="Holiday Calendar" />
          <FeaturePill icon={<Receipt size={14} />} label="Tax Analytics (ITR)" />
          <FeaturePill icon={<Bot size={14} />} label="AI Trade Coach" />
          <FeaturePill icon={<IndianRupee size={14} />} label="INR First — Always" />
        </div>

        {/* ── How it works ── */}
        <div style={{ marginTop: '72px', width: '100%', maxWidth: '760px' }}>
          <h2 style={{
            fontSize: '22px', fontWeight: 700, color: '#111827',
            marginBottom: '32px', letterSpacing: '-0.4px',
          }}>
            How it works
          </h2>
          <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', justifyContent: 'center' }}>
            {[
              { step: '01', title: 'Sign in with Google', desc: 'One click — no form, no password. We ask for Google Drive permission to store your journal file.' },
              { step: '02', title: 'Add your trades', desc: 'Log trades manually or upload your broker CSV. RELIANCE, BANKNIFTY, TATASTEEL — all NSE symbols auto-suggest.' },
              { step: '03', title: 'Grow your edge', desc: 'See your win rate, drawdown, P/L patterns. Know when you trade best — and when to stop.' },
            ].map(({ step, title, desc }) => (
              <div key={step} style={{
                flex: '1 1 200px', padding: '24px',
                backgroundColor: '#ffffff', borderRadius: '14px',
                border: '1px solid #f3f4f6',
                boxShadow: '0 1px 6px -2px rgba(0,0,0,0.06)',
                textAlign: 'left',
              }}>
                <div style={{
                  fontSize: '11px', fontWeight: 800, color: '#f97316',
                  letterSpacing: '1px', marginBottom: '10px',
                }}>
                  STEP {step}
                </div>
                <div style={{ fontSize: '15px', fontWeight: 700, color: '#111827', marginBottom: '8px' }}>
                  {title}
                </div>
                <div style={{ fontSize: '13px', color: '#6b7280', lineHeight: 1.6 }}>
                  {desc}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Privacy callout ── */}
        <div style={{
          marginTop: '56px', maxWidth: '560px',
          padding: '24px 28px',
          backgroundColor: '#f0fdf4',
          borderRadius: '14px',
          border: '1px solid #bbf7d0',
          display: 'flex', alignItems: 'flex-start', gap: '14px',
          textAlign: 'left',
        }}>
          <ShieldCheck size={24} style={{ color: '#166534', flexShrink: 0, marginTop: '2px' }} />
          <div>
            <div style={{ fontWeight: 700, fontSize: '14px', color: '#14532d', marginBottom: '6px' }}>
              Your data never touches our servers
            </div>
            <div style={{ fontSize: '13px', color: '#166534', lineHeight: 1.6 }}>
              All your trade data is saved directly to a JSON file in <strong>your personal Google Drive</strong>. 
              We can't see it, read it, or sell it. If you delete your Drive file, it's gone — forever. 
              Total ownership, total privacy.
            </div>
          </div>
        </div>

        {/* ── Final CTA ── */}
        <div style={{ marginTop: '56px', display: 'flex', gap: '16px', flexWrap: 'wrap', justifyContent: 'center' }}>
          <button
            onClick={onGoogleLogin}
            disabled={isLoading}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '10px',
              padding: '13px 30px',
              backgroundColor: hovered ? '#1a1a2e' : '#111827',
              color: '#ffffff',
              border: 'none', borderRadius: '12px',
              fontSize: '14px', fontWeight: 600, cursor: 'pointer',
              boxShadow: '0 4px 14px -4px rgba(0,0,0,0.25)',
              transform: hovered ? 'translateY(-1px)' : 'translateY(0)',
              transition: 'all 0.18s ease',
            }}
          >
            <div style={{
              width: '28px', height: '28px', borderRadius: '5px',
              backgroundColor: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <GoogleIcon />
            </div>
            <span>Start journaling with Google</span>
          </button>
        </div>
      </main>

      {/* ── Footer ── */}
      <footer style={{
        padding: '20px 40px', textAlign: 'center',
        borderTop: '1px solid #f3f4f6', backgroundColor: '#ffffff',
        fontSize: '12px', color: '#9ca3af', fontWeight: 400,
      }}>
        FoxTrade (foxtrade.in) — Built for Indian retail traders · Data stays in your Google Drive ·{' '}
        <span style={{ color: '#f97316', fontWeight: 600 }}>Privacy First</span>
      </footer>
    </div>
  );
}
