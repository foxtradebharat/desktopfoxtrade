import React, { useMemo } from 'react';
import { 
  Trophy, Flame, Shield, Award, Star, CheckCircle2, Zap, 
  Target, Lock, Share2, Crosshair, Sparkles, Crown 
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function MilestonesPage({ trades = [] }) {
  const closedTrades = useMemo(() => trades.filter(t => t.status === 'Closed'), [trades]);

  const wins = closedTrades.filter(t => (t.pnl || 0) > 0);
  const winRate = closedTrades.length > 0 ? (wins.length / closedTrades.length) * 100 : 0;
  const noFomoTrades = closedTrades.filter(t => t.emotion !== 'FOMO');
  const noFomoPct = closedTrades.length > 0 ? Math.round((noFomoTrades.length / closedTrades.length) * 100) : 100;

  const MILESTONES = [
    {
      id: 'arjuna',
      title: "Arjuna's Focus",
      icon: Crosshair,
      desc: 'Log 25+ trades consistently with complete tags and notes.',
      current: closedTrades.length,
      target: 25,
      unit: 'trades',
      unlocked: closedTrades.length >= 25,
      color: '#3b82f6'
    },
    {
      id: 'kurukshetra',
      title: 'Consistent Kurukshetra',
      icon: Flame,
      desc: 'Maintain overall positive realized P&L.',
      current: closedTrades.reduce((acc, t) => acc + (t.pnl || 0), 0) > 0 ? 1 : 0,
      target: 1,
      unit: 'profitable',
      unlocked: closedTrades.reduce((acc, t) => acc + (t.pnl || 0), 0) > 0,
      color: '#10b981'
    },
    {
      id: 'fomo_warrior',
      title: 'No-FOMO Warrior',
      icon: Sparkles,
      desc: 'Achieve 80%+ trades executed without FOMO or Revenge tags.',
      current: noFomoPct,
      target: 80,
      unit: '%',
      unlocked: noFomoPct >= 80 && closedTrades.length >= 5,
      color: '#8b5cf6'
    },
    {
      id: 'sharp_shooter',
      title: 'Sharp Shooter',
      icon: Target,
      desc: 'Achieve a winning rate of 60% or higher.',
      current: Math.round(winRate),
      target: 60,
      unit: '% win rate',
      unlocked: winRate >= 60 && closedTrades.length >= 5,
      color: '#f59e0b'
    },
    {
      id: 'risk_guardian',
      title: 'Risk Guardian',
      icon: Shield,
      desc: 'Execute 10 consecutive trades with defined Stop-Loss levels.',
      current: closedTrades.filter(t => t.stopLoss > 0).length,
      target: 10,
      unit: 'sl trades',
      unlocked: closedTrades.filter(t => t.stopLoss > 0).length >= 10,
      color: '#06b6d4'
    },
    {
      id: 'centurion',
      title: 'Centurion Master',
      icon: Crown,
      desc: 'Complete 100 logged trades in your lifetime journal.',
      current: closedTrades.length,
      target: 100,
      unit: 'trades',
      unlocked: closedTrades.length >= 100,
      color: '#ec4899'
    }
  ];

  const unlockedCount = MILESTONES.filter(m => m.unlocked).length;

  return (
    <div style={{
      padding: '24px',
      maxWidth: '1400px',
      margin: '0 auto',
      display: 'flex',
      flexDirection: 'column',
      gap: '24px',
      paddingBottom: '100px'
    }}>
      {/* Top Banner */}
      <div style={{
        backgroundColor: 'var(--bg-card, #ffffff)',
        border: '1px solid var(--border-color, #e5e7eb)',
        borderRadius: '16px',
        padding: '24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: 'var(--shadow-card)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '12px',
            backgroundColor: 'rgba(234, 179, 8, 0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Trophy size={24} color="#eab308" />
          </div>
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary, #111827)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>Trader Milestones &amp; Streaks</span>
              <Trophy size={18} className="text-amber-500 inline" />
            </h1>
            <p style={{ fontSize: '13px', color: 'var(--text-muted, #6b7280)', margin: '4px 0 0 0' }}>
              Gamify your discipline, track streaks, and unlock trader achievements
            </p>
          </div>
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          backgroundColor: 'var(--bg-primary, #f9fafb)',
          padding: '10px 18px',
          borderRadius: '12px',
          border: '1px solid var(--border-color, #e5e7eb)'
        }}>
          <Flame size={20} color="#f97316" />
          <div>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted, #6b7280)' }}>BADGES UNLOCKED</div>
            <div style={{ fontSize: '18px', fontWeight: 900, color: 'var(--text-primary, #111827)' }}>
              {unlockedCount} / {MILESTONES.length}
            </div>
          </div>
        </div>
      </div>

      {/* Badges Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '16px'
      }}>
        {MILESTONES.map((m) => {
          const progressPct = Math.min(100, Math.round((m.current / m.target) * 100));
          const IconComponent = m.icon;
          return (
            <Card
              key={m.id}
              className={`flex flex-col justify-between transition-all ${
                m.unlocked ? 'opacity-100 shadow-sm border-border' : 'opacity-85 shadow-none border-border/70'
              }`}
            >
              <CardContent className="p-5 flex flex-col justify-between h-full">
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                    <div style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '10px',
                      backgroundColor: m.unlocked ? `${m.color}18` : 'var(--bg-primary, #f3f4f6)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: m.unlocked ? m.color : 'var(--text-muted, #9ca3af)',
                      border: `1px solid ${m.unlocked ? m.color + '35' : 'var(--border-color, #e5e7eb)'}`
                    }}>
                      <IconComponent size={20} />
                    </div>
                    {m.unlocked ? (
                      <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 gap-1 text-[10px] font-bold">
                        <CheckCircle2 size={11} />
                        UNLOCKED
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="gap-1 text-[10px] font-medium text-muted-foreground">
                        <Lock size={11} />
                        LOCKED
                      </Badge>
                    )}
                  </div>

                  <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary, #111827)' }}>
                    {m.title}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted, #6b7280)', marginTop: '4px', lineHeight: 1.4 }}>
                    {m.desc}
                  </div>
                </div>

                {/* Progress Bar */}
                <div style={{ marginTop: '18px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted, #6b7280)', marginBottom: '6px' }}>
                    <span>Progress</span>
                    <span>{m.current} / {m.target} {m.unit} ({progressPct}%)</span>
                  </div>
                  <div style={{
                    height: '6px',
                    backgroundColor: 'var(--bg-primary, #f3f4f6)',
                    borderRadius: '9999px',
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      height: '100%',
                      width: `${progressPct}%`,
                      backgroundColor: m.unlocked ? m.color : '#9ca3af',
                      borderRadius: '9999px',
                      transition: 'width 0.3s ease'
                    }} />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
