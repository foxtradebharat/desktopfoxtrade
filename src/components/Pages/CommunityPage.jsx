import React, { useState } from 'react';
import { 
  Trophy, Users, Sparkles, Bell, CheckCircle2, MessageSquare, 
  Flame, Shield, ArrowRight, Crown 
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function CommunityPage({ user }) {
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
        {/* Glowing Animated Icon Badge */}
        <div style={{
          position: 'relative',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          {/* Subtle Glow backdrop */}
          <div style={{
            position: 'absolute',
            width: '100px',
            height: '100px',
            borderRadius: '50%',
            backgroundColor: 'rgba(234, 179, 8, 0.25)',
            filter: 'blur(24px)'
          }} />
          
          <div style={{
            position: 'relative',
            width: '76px',
            height: '76px',
            borderRadius: '24px',
            backgroundColor: 'var(--bg-card, #ffffff)',
            border: '1px solid rgba(234, 179, 8, 0.4)',
            boxShadow: '0 12px 30px -8px rgba(234, 179, 8, 0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Trophy size={36} color="#eab308" />
          </div>
        </div>

        {/* Coming Soon Pill */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 18px',
          borderRadius: '9999px',
          backgroundColor: 'rgba(234, 179, 8, 0.12)',
          border: '1px solid rgba(234, 179, 8, 0.3)',
          color: '#b45309',
          fontSize: '12px',
          fontWeight: 800,
          letterSpacing: '1px',
          textTransform: 'uppercase'
        }}>
          <Sparkles size={14} color="#d97706" />
          <span>COMING SOON</span>
        </div>

        {/* Headline */}
        <div>
          <h1 style={{
            fontSize: 'clamp(32px, 5vw, 44px)',
            fontWeight: 900,
            letterSpacing: '-0.03em',
            margin: '0 0 12px 0',
            color: 'var(--text-primary, #111827)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexWrap: 'wrap',
            gap: '8px'
          }}>
            <span>Trader Community &amp; Crown Leaderboard</span>
            <Trophy size={32} className="text-amber-500 inline" />
          </h1>
          <p style={{
            fontSize: '16px',
            color: 'var(--text-muted, #6b7280)',
            maxWidth: '560px',
            margin: '0 auto',
            lineHeight: 1.6
          }}>
            Connect with verified Indian retail traders, exchange proven price-action setups, and compete on the monthly verified P&amp;L leaderboard.
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
          <Card className="text-left border-border shadow-sm">
            <CardContent className="p-5">
              <Trophy size={22} className="text-amber-500 mb-2" />
              <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-primary, #111827)' }}>
                Verified Leaderboard
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted, #6b7280)', marginTop: '4px', lineHeight: 1.4 }}>
                Monthly ROI ranking backed by broker tradebook reconciliations.
              </div>
            </CardContent>
          </Card>

          <Card className="text-left border-border shadow-sm">
            <CardContent className="p-5">
              <MessageSquare size={22} className="text-foreground mb-2" />
              <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-primary, #111827)' }}>
                Trade Sharing Feed
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted, #6b7280)', marginTop: '4px', lineHeight: 1.4 }}>
                Share charts &amp; lessons learned without revealing private P&amp;L numbers.
              </div>
            </CardContent>
          </Card>

          <Card className="text-left border-border shadow-sm">
            <CardContent className="p-5">
              <Crown size={22} className="text-amber-500 mb-2" />
              <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-primary, #111827)' }}>
                Crown Tier Badges
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted, #6b7280)', marginTop: '4px', lineHeight: 1.4 }}>
                Earn badges for risk compliance, zero-FOMO weeks, and discipline.
              </div>
            </CardContent>
          </Card>
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
              <span>You're on the early access priority list!</span>
            </div>
          ) : (
            <form onSubmit={handleNotifyMe} className="flex gap-2">
              <Input
                type="email"
                placeholder={user?.email || 'Enter your email for early invite...'}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11 rounded-xl bg-card border-border text-foreground text-sm"
              />
              <Button
                type="submit"
                className="h-11 px-6 rounded-xl bg-foreground text-background hover:bg-foreground/90 font-bold whitespace-nowrap gap-2 shadow-sm"
              >
                <span>Notify Me</span>
                <ArrowRight size={15} />
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
