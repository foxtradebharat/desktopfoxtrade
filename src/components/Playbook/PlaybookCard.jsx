import React, { useMemo } from 'react';
import {
  TrendingUp,
  Target,
  Zap,
  ShieldCheck,
  ArrowRight,
  Layers,
  Award
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { calculatePlaybookMetrics } from '../../services/playbookService';
import { PlaybookIconView } from './playbookIcons';

export default function PlaybookCard({
  playbook,
  allTrades = [],
  tradeAudits = {},
  missedTrades = [],
  settings = null,
  onSelectPlaybook
}) {
  const metrics = useMemo(() => {
    return calculatePlaybookMetrics(playbook, allTrades, tradeAudits, missedTrades, settings);
  }, [playbook, allTrades, tradeAudits, missedTrades, settings]);

  if (!metrics) return null;

  const isProfit = metrics.netPnL >= 0;
  const pnlColor = isProfit ? '#10b981' : '#ef4444';

  const formatCurrency = (val) => {
    const num = Number(val) || 0;
    const sign = num < 0 ? '-' : num > 0 ? '+' : '';
    return `${sign}₹${Math.abs(num).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
  };

  const targetWr = playbook.targetWinRate || 60;
  const actualWr = metrics.winRate;
  const wrColor = actualWr >= targetWr ? '#10b981' : actualWr > 0 ? 'var(--text-primary)' : 'var(--text-muted)';

  const targetRr = playbook.targetRiskReward || 2.0;
  const actualRr = metrics.avgRMultiple;

  return (
    <Card
      onClick={() => onSelectPlaybook(playbook)}
      className="cursor-pointer transition-all hover:border-foreground/20 hover:-translate-y-0.5 hover:shadow-sm border-[color-mix(in_srgb,var(--border-color)_25%,transparent)] bg-card p-6 flex flex-col gap-4 relative rounded-2xl"
    >
      {/* Top Header: Title & Badges */}
      <div>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 11 }}>
            {/* Playbook Accent Icon */}
            <div style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: `color-mix(in srgb, ${playbook.colorHex || '#3b82f6'} 14%, transparent)`,
              border: `1px solid color-mix(in srgb, ${playbook.colorHex || '#3b82f6'} 28%, transparent)`,
              flexShrink: 0,
              marginTop: 1
            }}>
              <PlaybookIconView
                name={playbook.icon}
                size={17}
                color={playbook.colorHex || '#3b82f6'}
                strokeWidth={2.2}
              />
            </div>

            <div>
              <h3 style={{
                fontSize: 15,
                fontWeight: 600,
                color: 'var(--text-primary)',
                margin: '0 0 6px 0',
                lineHeight: 1.4
              }}>
                {playbook.title}
              </h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                {/* Strategy Badge */}
                <Badge variant="outline" className="text-[10px] font-normal tracking-wide py-0.5 px-2 border-[color-mix(in_srgb,var(--border-color)_30%,transparent)] bg-muted/20 text-muted-foreground">
                  {playbook.strategyType || 'Setup'}
                </Badge>

                {/* Segments */}
                {(playbook.applicableSegments || []).map(seg => (
                  <Badge
                    key={seg}
                    variant="secondary"
                    className="text-[9.5px] font-normal py-0.5 px-1.5 border-transparent bg-muted/30 text-muted-foreground"
                  >
                    {seg}
                  </Badge>
                ))}
              </div>
            </div>
          </div>

          {/* Discipline Badge — subtle minimalist outline with 2px accent */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '3px 8px',
            borderRadius: 6,
            background: 'var(--bg-surface)',
            border: '1px solid color-mix(in srgb, var(--border-color) 25%, transparent)',
            borderLeft: `2px solid ${metrics.rulesFollowedScore >= 90 ? '#10b981' : '#f59e0b'}`,
            color: metrics.rulesFollowedScore >= 90 ? '#10b981' : '#d97706',
            fontSize: 11,
            fontWeight: 500,
            fontFamily: 'var(--font-mono)'
          }}>
            <ShieldCheck size={12} />
            <span>{metrics.rulesFollowedScore}%</span>
          </div>
        </div>

        {playbook.description && (
          <p style={{
            fontSize: 12,
            fontWeight: 400,
            color: 'var(--text-secondary)',
            margin: '10px 0 0 0',
            lineHeight: 1.55,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden'
          }}>
            {playbook.description}
          </p>
        )}
      </div>

      {/* Metrics Row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 10,
        padding: '12px 14px',
        borderRadius: 10,
        background: 'var(--bg-primary)',
        border: '1px solid color-mix(in srgb, var(--border-color) 20%, transparent)'
      }}>
        {/* Win Rate */}
        <div>
          <div style={{ fontSize: 10, fontWeight: 450, color: 'var(--text-muted)', letterSpacing: '0.04em', lineHeight: 1.5 }}>
            Win Rate
          </div>
          <div style={{ fontSize: 13.5, fontWeight: 500, fontFamily: 'var(--font-mono)', color: wrColor, marginTop: 2, lineHeight: 1.5 }}>
            {metrics.winRate.toFixed(0)}%
          </div>
          <div style={{ fontSize: 9.5, fontWeight: 400, color: 'var(--text-muted)', lineHeight: 1.4 }}>
            Target: {targetWr}%
          </div>
        </div>

        {/* Avg R:R */}
        <div>
          <div style={{ fontSize: 10, fontWeight: 450, color: 'var(--text-muted)', letterSpacing: '0.04em', lineHeight: 1.5 }}>
            Avg R:R
          </div>
          <div style={{ fontSize: 13.5, fontWeight: 500, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', marginTop: 2, lineHeight: 1.5 }}>
            {metrics.avgRMultiple > 0 ? `${metrics.avgRMultiple.toFixed(1)}R` : '—'}
          </div>
          <div style={{ fontSize: 9.5, fontWeight: 400, color: 'var(--text-muted)', lineHeight: 1.4 }}>
            Target: {targetRr}R
          </div>
        </div>

        {/* Profit Factor */}
        <div>
          <div style={{ fontSize: 10, fontWeight: 450, color: 'var(--text-muted)', letterSpacing: '0.04em', lineHeight: 1.5 }}>
            Profit Factor
          </div>
          <div style={{ fontSize: 13.5, fontWeight: 500, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', marginTop: 2, lineHeight: 1.5 }}>
            {metrics.profitFactor > 0 ? metrics.profitFactor.toFixed(2) : '0.00'}
          </div>
          <div style={{ fontSize: 9.5, fontWeight: 400, color: 'var(--text-muted)', lineHeight: 1.4 }}>
            {metrics.totalTrades} {metrics.totalTrades === 1 ? 'trade' : 'trades'}
          </div>
        </div>
      </div>

      {/* Footer: Net P&L & Enter setup action */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: 10,
        borderTop: '1px solid color-mix(in srgb, var(--border-color) 20%, transparent)'
      }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 450, color: 'var(--text-muted)', letterSpacing: '0.04em', lineHeight: 1.5 }}>
            Net Realized
          </div>
          <div style={{
            fontSize: 16,
            fontWeight: 600,
            fontFamily: 'var(--font-mono)',
            color: pnlColor,
            lineHeight: 1.4
          }}>
            {formatCurrency(metrics.netPnL)}
          </div>
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          fontSize: 11.5,
          fontWeight: 450,
          color: 'var(--text-secondary)',
          transition: 'color 0.15s ease'
        }}>
          <span>View Setup</span>
          <ArrowRight size={13} />
        </div>
      </div>
    </Card>
  );
}
