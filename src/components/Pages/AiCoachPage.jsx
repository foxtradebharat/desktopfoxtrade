import React, { useState } from 'react';
import { Bot, Sparkles, Bell, CheckCircle2, Zap, Brain, ShieldAlert, Target, ArrowRight, Search, Shield } from 'lucide-react';

export default function AiCoachPage() {
  const [email, setEmail] = useState('');
  const [isSubscribed, setIsSubscribed] = useState(false);

  const handleNotifyMe = (e) => {
    e.preventDefault();
    if (email.trim()) {
      setIsSubscribed(true);
    }
  };

  return (
    <div style={{
      minHeight: '75vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 20px 100px 20px',
      color: 'var(--text-primary, #111827)'
    }}>
      <div style={{
        maxWidth: '720px',
        width: '100%',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '24px'
      }}>
        {/* Glowing Neural AI Orb Badge */}
        <div style={{
          position: 'relative',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          {/* Subtle Glow backdrop */}
          <div style={{
            position: 'absolute',
            width: '110px',
            height: '110px',
            borderRadius: '50%',
            backgroundColor: 'rgba(59, 130, 246, 0.25)',
            filter: 'blur(28px)'
          }} />
          
          <div style={{
            position: 'relative',
            width: '76px',
            height: '76px',
            borderRadius: '24px',
            backgroundColor: 'var(--bg-card, #ffffff)',
            border: '1px solid rgba(59, 130, 246, 0.4)',
            boxShadow: '0 12px 30px -8px rgba(59, 130, 246, 0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Bot size={36} color="#3b82f6" />
          </div>
        </div>

        {/* Coming Soon Pill */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 18px',
          borderRadius: '9999px',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          border: '1px solid rgba(59, 130, 246, 0.3)',
          color: '#2563eb',
          fontSize: '12px',
          fontWeight: 800,
          letterSpacing: '1px',
          textTransform: 'uppercase'
        }}>
          <Sparkles size={14} color="#3b82f6" />
          <span>COMING SOON</span>
        </div>

        {/* Headline */}
        <div>
          <h1 style={{
            fontSize: 'clamp(32px, 5vw, 44px)',
            fontWeight: 900,
            letterSpacing: '-0.03em',
            margin: '0 0 12px 0',
            color: 'var(--text-primary, #111827)'
          }}>
            AI Loss Coach & Behavior Diagnostic
          </h1>
          <p style={{
            fontSize: '16px',
            color: 'var(--text-muted, #6b7280)',
            maxWidth: '580px',
            margin: '0 auto',
            lineHeight: 1.6
          }}>
            Powered by Google Gemini 1.5 Pro. An intelligent hedge-fund risk officer analyzing your execution history to tell you exactly <em>why</em> you lost money and the top 3 tactical fixes to turn green.
          </p>
        </div>

        {/* Sneak Peek Feature Highlights */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '16px',
          width: '100%',
          marginTop: '12px'
        }}>
          <div style={{
            backgroundColor: 'var(--bg-card, #ffffff)',
            border: '1px solid var(--border-color, #e5e7eb)',
            borderRadius: '16px',
            padding: '20px 16px',
            boxShadow: 'var(--shadow-card)',
            textAlign: 'left'
          }}>
            <div style={{ marginBottom: '8px', color: 'var(--text-primary, #111827)' }}>
              <Search size={20} strokeWidth={1.8} />
            </div>
            <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-primary, #111827)' }}>
              Loss Leak Diagnosis
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted, #6b7280)', marginTop: '4px', lineHeight: 1.4 }}>
              Discovers hidden leaks like holding losers too long or post-loss position doubling.
            </div>
          </div>

          <div style={{
            backgroundColor: 'var(--bg-card, #ffffff)',
            border: '1px solid var(--border-color, #e5e7eb)',
            borderRadius: '16px',
            padding: '20px 16px',
            boxShadow: 'var(--shadow-card)',
            textAlign: 'left'
          }}>
            <div style={{ marginBottom: '8px', color: 'var(--text-primary, #111827)' }}>
              <Target size={20} strokeWidth={1.8} />
            </div>
            <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-primary, #111827)' }}>
              3-Point Weekly Fixes
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted, #6b7280)', marginTop: '4px', lineHeight: 1.4 }}>
              Concrete rules personalized to your specific trade setups and instrument choices.
            </div>
          </div>

          <div style={{
            backgroundColor: 'var(--bg-card, #ffffff)',
            border: '1px solid var(--border-color, #e5e7eb)',
            borderRadius: '16px',
            padding: '20px 16px',
            boxShadow: 'var(--shadow-card)',
            textAlign: 'left'
          }}>
            <div style={{ marginBottom: '8px', color: 'var(--text-primary, #111827)' }}>
              <Shield size={20} strokeWidth={1.8} />
            </div>
            <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-primary, #111827)' }}>
              Risk & Sizing Score
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted, #6b7280)', marginTop: '4px', lineHeight: 1.4 }}>
              Quantitative 1-100 risk score measuring discipline, R:R consistency, and stops.
            </div>
          </div>
        </div>

        {/* Priority Access Waitlist Form */}
        <div style={{
          marginTop: '8px',
          width: '100%',
          maxWidth: '460px'
        }}>
          {isSubscribed ? (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '14px 20px',
              borderRadius: '12px',
              backgroundColor: '#ecfdf5',
              border: '1px solid #a7f3d0',
              color: '#065f46',
              fontSize: '13px',
              fontWeight: 700
            }}>
              <CheckCircle2 size={18} color="#059669" />
              <span>You're on the AI Beta Priority list!</span>
            </div>
          ) : (
            <form onSubmit={handleNotifyMe} style={{ display: 'flex', gap: '8px' }}>
              <input
                type="email"
                placeholder="Enter email to get AI Beta invite..."
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{
                  flex: 1,
                  padding: '12px 16px',
                  borderRadius: '12px',
                  border: '1px solid var(--border-color, #d1d5db)',
                  fontSize: '13px',
                  backgroundColor: 'var(--bg-card, #ffffff)',
                  color: 'var(--text-primary, #111827)',
                  outline: 'none',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                }}
              />
              <button
                type="submit"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '12px 20px',
                  backgroundColor: '#2563eb',
                  color: '#ffffff',
                  borderRadius: '12px',
                  border: 'none',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)'
                }}>
                <Bell size={14} />
                <span>Get Early Access</span>
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
