import React, { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  Cell,
  ReferenceLine,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  Info,
  ShieldCheck,
  Award,
  Zap,
  Target,
  AlertTriangle,
  Sparkles,
  Download,
  FileSpreadsheet,
  FileCode,
  ShieldAlert,
  BarChart2,
  Calendar,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Sunrise,
  Sun,
  Sunset,
  Flame,
  CheckCircle2
} from 'lucide-react';
import {
  calculatePlaybookMetrics,
  calculateDailyCumulativePnL,
  calculateCostOfIndiscipline,
  calculateDistributionAnalytics,
  calculateAdvancedKPIs,
  generateAIPatternInsights,
  checkStrategyAlerts,
  exportPlaybookToCSV,
  exportPlaybookToJSON,
  getTradePnL,
  parseTradeDateMs
} from '../../services/playbookService';

function SectionInfoTooltip({ tooltip }) {
  const [show, setShow] = useState(false);
  return (
    <div
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      <button
        type="button"
        onClick={() => setShow(prev => !prev)}
        style={{
          width: 19,
          height: 19,
          borderRadius: '50%',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: show ? 'color-mix(in srgb, var(--text-primary) 12%, transparent)' : 'color-mix(in srgb, var(--text-primary) 6%, transparent)',
          border: '1px solid color-mix(in srgb, var(--border-color) 25%, transparent)',
          color: show ? 'var(--text-primary)' : 'var(--text-muted)',
          cursor: 'pointer',
          padding: 0,
          transition: 'all 0.15s ease'
        }}
        aria-label="Section explanation"
      >
        <Info size={11} />
      </button>
      {show && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 6px)',
          left: 0,
          zIndex: 60,
          background: 'var(--bg-card)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid color-mix(in srgb, var(--border-color) 35%, transparent)',
          boxShadow: '0 10px 28px rgba(0,0,0,0.3)',
          borderRadius: 8,
          padding: '8px 12px',
          width: 'max-content',
          maxWidth: 290,
          fontSize: 11.5,
          fontWeight: 450,
          lineHeight: 1.45,
          color: 'var(--text-primary)',
          pointerEvents: 'none'
        }}>
          {tooltip}
        </div>
      )}
    </div>
  );
}

export default function PlaybookOverviewTab({
  playbook,
  allTrades = [],
  tradeAudits = {},
  missedTrades = [],
  settings = null,
  onOpenAuditModal = null
}) {
  const metrics = useMemo(() => {
    return calculatePlaybookMetrics(playbook, allTrades, tradeAudits, missedTrades, settings);
  }, [playbook, allTrades, tradeAudits, missedTrades, settings]);

  const chartData = useMemo(() => {
    return calculateDailyCumulativePnL(metrics?.pbTrades || []);
  }, [metrics]);

  // Smooth spline interpolation for single/few trades to produce Option 2's organic Apple Stocks curve
  const displayChartData = useMemo(() => {
    if (!chartData || chartData.length === 0) return [];
    if (chartData.length === 2 && chartData[0].date === 'Baseline') {
      const startVal = chartData[0].cumulativePnL || 0;
      const endVal = chartData[1].cumulativePnL || 0;
      const targetDate = chartData[1].date;
      const steps = 10;
      const interpolated = [];
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        // Cubic smoothstep easing (3t^2 - 2t^3)
        const ease = t * t * (3 - 2 * t);
        const curVal = Math.round(startVal + (endVal - startVal) * ease);
        interpolated.push({
          date: i === 0 ? 'Baseline' : i === steps ? targetDate : '',
          tooltipDate: targetDate,
          cumulativePnL: curVal,
          isPeak: i === steps,
          actualPnL: endVal
        });
      }
      return interpolated;
    }
    return chartData.map((d, i) => ({
      ...d,
      tooltipDate: d.date,
      isPeak: i === chartData.length - 1,
      actualPnL: d.cumulativePnL
    }));
  }, [chartData]);

  const indiscipline = useMemo(() => {
    return calculateCostOfIndiscipline(metrics?.pbTrades || [], tradeAudits, settings);
  }, [metrics, tradeAudits, settings]);

  const distribution = useMemo(() => {
    return calculateDistributionAnalytics(metrics?.pbTrades || []);
  }, [metrics]);

  const advKPIs = useMemo(() => {
    return calculateAdvancedKPIs(metrics?.pbTrades || [], settings);
  }, [metrics, settings]);

  const alerts = useMemo(() => {
    return checkStrategyAlerts(playbook, metrics?.pbTrades || [], metrics, settings);
  }, [playbook, metrics, settings]);

  const aiInsights = useMemo(() => {
    return generateAIPatternInsights(playbook, metrics?.pbTrades || [], tradeAudits);
  }, [playbook, metrics, tradeAudits]);

  const [activeTooltip, setActiveTooltip] = useState(null);
  const [histogramMode, setHistogramMode] = useState('rMultiple'); // 'rMultiple' | 'pnl'
  const [chartStrokeWidth, setChartStrokeWidth] = useState(4.5); // Default thick/prominent graph line width

  if (!metrics) return null;

  const isNetProfit = metrics.netPnL >= 0;
  const pnlColor = isNetProfit ? '#10b981' : '#ef4444';

  const formatCurrency = (val) => {
    const num = Number(val) || 0;
    const sign = num < 0 ? '-' : '';
    return `${sign}₹${Math.abs(num).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
  };

  const formatBleed = (val) => {
    const num = Number(val) || 0;
    if (num <= 0) return '₹0';
    return `-₹${Math.abs(num).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
  };

  // Monotonic chronological streak calculations (oldest to newest)
  const sortedChronTrades = useMemo(() => {
    return [...(metrics.pbTrades || [])].sort((a, b) => parseTradeDateMs(a) - parseTradeDateMs(b));
  }, [metrics.pbTrades]);

  let maxWinStreak = 0;
  let maxLossStreak = 0;
  let curWin = 0;
  let curLoss = 0;
  sortedChronTrades.forEach(t => {
    const p = getTradePnL(t);
    if (p > 0) {
      curWin++;
      curLoss = 0;
      if (curWin > maxWinStreak) maxWinStreak = curWin;
    } else if (p < 0) {
      curLoss++;
      curWin = 0;
      if (curLoss > maxLossStreak) maxLossStreak = curLoss;
    } else {
      // Breakeven trade resets consecutive run
      curWin = 0;
      curLoss = 0;
    }
  });

  const payoffRatio = metrics.avgLoser > 0
    ? (metrics.avgWinner / Math.abs(metrics.avgLoser))
    : metrics.avgWinner > 0 ? 9.99 : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
      {/* ── Onboarding / Empty State Banner when 0 trades tagged ── */}
      {metrics.totalTrades === 0 && (
        <div style={{
          padding: '20px 24px',
          borderRadius: 14,
          background: 'var(--bg-surface)',
          border: '1px dashed color-mix(in srgb, var(--border-color) 35%, transparent)',
          display: 'flex',
          flexDirection: 'column',
          gap: 12
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 34,
                height: 34,
                borderRadius: 8,
                background: 'rgba(59, 130, 246, 0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#3b82f6',
                flexShrink: 0
              }}>
                <Target size={18} />
              </div>
              <div>
                <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)' }}>
                  No Trades Tagged to "{playbook.title}" Yet
                </span>
                <p style={{ fontSize: 11.5, color: 'var(--text-muted)', margin: '2px 0 0 0', lineHeight: 1.5 }}>
                  Tag trades from your journal to activate live equity curves, checklist discipline scores, and risk statistics.
                </p>
              </div>
            </div>
            {onOpenAuditModal && (
              <button
                type="button"
                onClick={() => onOpenAuditModal(null, playbook.id)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '7px 14px',
                  borderRadius: 8,
                  border: '1px solid color-mix(in srgb, var(--border-color) 35%, transparent)',
                  background: 'color-mix(in srgb, var(--text-primary) 8%, var(--bg-surface))',
                  color: 'var(--text-primary)',
                  fontSize: 12,
                  fontWeight: 550,
                  cursor: 'pointer',
                  transition: 'all 0.18s ease'
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'color-mix(in srgb, var(--text-primary) 12%, var(--bg-surface))'}
                onMouseLeave={e => e.currentTarget.style.background = 'color-mix(in srgb, var(--text-primary) 8%, var(--bg-surface))'}
              >
                <span>Audit & Tag a Trade</span>
              </button>
            )}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12, borderTop: '1px solid color-mix(in srgb, var(--border-color) 20%, transparent)', paddingTop: 10 }}>
            <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              <strong style={{ fontWeight: 500 }}>Method 1 (Audit Checklist):</strong> Click <em>"Audit Trade"</em> at the top to check an execution against your setup criteria.
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              <strong style={{ fontWeight: 500 }}>Method 2 (Journal Setup):</strong> In your trade journal table, select <code>"{playbook.title}"</code> in the Setup column.
            </div>
          </div>
        </div>
      )}

      {/* ── Active Strategy Alerts & Drawdown Guardrails ── */}
      {alerts.length > 0 && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          padding: '18px 24px',
          borderRadius: 14,
          background: 'var(--bg-surface)',
          border: '1px solid color-mix(in srgb, var(--border-color) 25%, transparent)',
          borderLeft: '3px solid #f59e0b'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ShieldAlert size={15} color="#f59e0b" />
            <span style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--text-primary)', letterSpacing: '0.01em' }}>
              Active Playbook Guardrails &amp; Risk Alerts
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 2 }}>
            {alerts.map(al => (
              <div key={al.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12 }}>
                <span style={{
                  padding: '2px 7px',
                  borderRadius: 5,
                  fontSize: 10.5,
                  fontWeight: 500,
                  fontFamily: 'var(--font-mono)',
                  background: al.severity === 'danger' ? 'rgba(239,68,68,0.08)' : al.severity === 'warning' ? 'rgba(245,158,11,0.08)' : 'var(--bg-primary)',
                  color: al.severity === 'danger' ? '#ef4444' : al.severity === 'warning' ? '#f59e0b' : 'var(--text-secondary)',
                  border: `1px solid ${al.severity === 'danger' ? 'rgba(239,68,68,0.2)' : al.severity === 'warning' ? 'rgba(245,158,11,0.2)' : 'color-mix(in srgb, var(--border-color) 20%, transparent)'}`,
                  marginTop: 1
                }}>
                  {al.title}
                </span>
                <span style={{ color: 'var(--text-secondary)', flex: 1, lineHeight: 1.5 }}>{al.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Key Performance Metrics (4 Spacious Cards) ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: 20
      }}>
        {/* Card 1: Core Performance */}
        <div style={{
          background: 'var(--bg-surface)',
          border: '1px solid color-mix(in srgb, var(--border-color) 25%, transparent)',
          borderRadius: 16,
          padding: '24px 24px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <h4 style={{ fontWeight: 600, fontSize: 15.5, color: 'var(--text-primary)', margin: 0 }}>
                Core Performance
              </h4>
              <span style={{ fontSize: 11, fontWeight: 450, letterSpacing: '0.04em', color: 'var(--text-muted)' }}>
                Summary
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Net Realized P&amp;L</div>
                <div style={{ fontSize: 22, fontWeight: 600, fontFamily: 'var(--font-mono)', color: pnlColor }}>
                  {formatCurrency(metrics.netPnL)}
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid color-mix(in srgb, var(--border-color) 20%, transparent)', paddingTop: 10 }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Win Rate</span>
                <span style={{ fontSize: 13, fontWeight: 500, fontFamily: 'var(--font-mono)', color: metrics.winRate >= 60 ? '#10b981' : '#f59e0b' }}>
                  {metrics.winRate.toFixed(1)}%
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid color-mix(in srgb, var(--border-color) 20%, transparent)', paddingTop: 10 }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Profit Factor</span>
                <span style={{ fontSize: 13, fontWeight: 500, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                  {metrics.totalTrades > 0 && metrics.profitFactor > 0 ? metrics.profitFactor.toFixed(2) : metrics.totalTrades > 0 ? '0.00' : '—'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid color-mix(in srgb, var(--border-color) 20%, transparent)', paddingTop: 10 }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Expectancy / Trade</span>
                <span style={{ fontSize: 13, fontWeight: 500, fontFamily: 'var(--font-mono)', color: metrics.expectancy >= 0 ? '#10b981' : '#ef4444' }}>
                  {formatCurrency(metrics.expectancy)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: Win / Loss Profile */}
        <div style={{
          background: 'var(--bg-surface)',
          border: '1px solid color-mix(in srgb, var(--border-color) 25%, transparent)',
          borderRadius: 16,
          padding: '24px 24px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <h4 style={{ fontWeight: 600, fontSize: 15.5, color: 'var(--text-primary)', margin: 0 }}>
                Win / Loss Profile
              </h4>
              <span style={{ fontSize: 11, fontWeight: 450, letterSpacing: '0.04em', color: 'var(--text-muted)' }}>
                Spread
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Avg Win</div>
                <div style={{ fontSize: 15, fontWeight: 500, fontFamily: 'var(--font-mono)', color: '#10b981' }}>
                  {formatCurrency(metrics.avgWinner)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Avg Loss</div>
                <div style={{ fontSize: 15, fontWeight: 500, fontFamily: 'var(--font-mono)', color: '#ef4444' }}>
                  {formatCurrency(metrics.avgLoser ? -Math.abs(metrics.avgLoser) : 0)}
                </div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12, borderTop: '1px solid color-mix(in srgb, var(--border-color) 20%, transparent)', paddingTop: 10 }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Payoff Ratio</div>
                <div style={{ fontSize: 13, fontWeight: 500, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                  {metrics.totalTrades > 0 ? `${payoffRatio.toFixed(2)}x` : '—'}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Win / Loss</div>
                <div style={{ fontSize: 13, fontWeight: 500, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                  {metrics.winnersCount || 0} / {metrics.losersCount || 0}
                </div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12, borderTop: '1px solid color-mix(in srgb, var(--border-color) 20%, transparent)', paddingTop: 10 }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Win Streak</div>
                <div style={{ fontSize: 13, fontWeight: 500, fontFamily: 'var(--font-mono)', color: '#10b981' }}>
                  {maxWinStreak}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Loss Streak</div>
                <div style={{ fontSize: 13, fontWeight: 500, fontFamily: 'var(--font-mono)', color: maxLossStreak > 0 ? '#ef4444' : 'var(--text-muted)' }}>
                  {maxLossStreak || 0}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Card 3: Extremes & Risk */}
        <div style={{
          background: 'var(--bg-surface)',
          border: '1px solid color-mix(in srgb, var(--border-color) 25%, transparent)',
          borderRadius: 16,
          padding: '24px 24px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <h4 style={{ fontWeight: 600, fontSize: 15.5, color: 'var(--text-primary)', margin: 0 }}>
                Extremes &amp; Risk
              </h4>
              <span style={{ fontSize: 11, fontWeight: 450, letterSpacing: '0.04em', color: 'var(--text-muted)' }}>
                Drawdowns
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Largest Win</span>
                <span style={{ fontSize: 13, fontWeight: 500, fontFamily: 'var(--font-mono)', color: '#10b981' }}>
                  {formatCurrency(metrics.largestProfit)}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid color-mix(in srgb, var(--border-color) 20%, transparent)', paddingTop: 10 }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Largest Loss</span>
                <span style={{ fontSize: 13, fontWeight: 500, fontFamily: 'var(--font-mono)', color: '#ef4444' }}>
                  {formatCurrency(metrics.largestLoss ? -Math.abs(metrics.largestLoss) : 0)}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid color-mix(in srgb, var(--border-color) 20%, transparent)', paddingTop: 10 }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Max Drawdown</span>
                <span style={{ fontSize: 13, fontWeight: 500, fontFamily: 'var(--font-mono)', color: '#ef4444' }}>
                  {metrics.totalTrades > 0 && advKPIs.maxDrawdownPct != null && advKPIs.maxDrawdownPct > 0 ? `-${advKPIs.maxDrawdownPct}%` : '—'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid color-mix(in srgb, var(--border-color) 20%, transparent)', paddingTop: 10 }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Sharpe Ratio</span>
                <span style={{ fontSize: 13, fontWeight: 500, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                  {metrics.totalTrades > 0 && advKPIs.sharpeRatio != null ? advKPIs.sharpeRatio : '—'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Card 4: R-Multiple & Discipline */}
        <div style={{
          background: 'var(--bg-surface)',
          border: '1px solid color-mix(in srgb, var(--border-color) 25%, transparent)',
          borderRadius: 16,
          padding: '24px 24px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <h4 style={{ fontWeight: 600, fontSize: 15.5, color: 'var(--text-primary)', margin: 0 }}>
                R-Multiple &amp; Rules
              </h4>
              <span style={{ fontSize: 11, fontWeight: 450, letterSpacing: '0.04em', color: 'var(--text-muted)' }}>
                Discipline
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Total R Gained</span>
                <span style={{ fontSize: 13, fontWeight: 500, fontFamily: 'var(--font-mono)', color: metrics.totalRMultiple >= 0 ? '#10b981' : '#ef4444' }}>
                  {metrics.totalRMultiple >= 0 ? '+' : ''}{metrics.totalRMultiple.toFixed(2)}R
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid color-mix(in srgb, var(--border-color) 20%, transparent)', paddingTop: 10 }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Avg R / Trade</span>
                <span style={{ fontSize: 13, fontWeight: 500, fontFamily: 'var(--font-mono)', color: metrics.avgRMultiple >= 0 ? '#10b981' : '#ef4444' }}>
                  {metrics.avgRMultiple >= 0 ? '+' : ''}{metrics.avgRMultiple.toFixed(2)}R
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid color-mix(in srgb, var(--border-color) 20%, transparent)', paddingTop: 10 }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Checklist Adherence</span>
                <span style={{ fontSize: 13, fontWeight: 500, fontFamily: 'var(--font-mono)', color: metrics.rulesFollowedScore >= 80 ? '#10b981' : '#f59e0b' }}>
                  {metrics.rulesFollowedScore}%
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid color-mix(in srgb, var(--border-color) 20%, transparent)', paddingTop: 10 }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Missed Setups</span>
                <span style={{ fontSize: 13, fontWeight: 500, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                  {metrics.missedTradesCount} {metrics.missedTradesCount === 1 ? 'setup' : 'setups'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Option 2: Ambient Aura & Bloom Cumulative P&L Trajectory ── */}
      <div style={{
        background: 'var(--bg-surface)',
        border: '1px solid color-mix(in srgb, var(--border-color) 25%, transparent)',
        borderRadius: 16,
        padding: '22px 20px 20px 20px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <h3 style={{
              fontSize: 16.5,
              fontWeight: 600,
              color: 'var(--text-primary)',
              margin: 0,
              letterSpacing: '-0.01em'
            }}>
              Cumulative P&amp;L Trajectory
            </h3>
            <SectionInfoTooltip tooltip="Chronological Strategy Equity Curve: Tracks cumulative net profit and loss trajectory across all executed trades tagged to this playbook." />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* Graph Stroke Width Selector */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              background: 'var(--bg-primary)',
              padding: '2px 3px',
              borderRadius: 8,
              border: '1px solid color-mix(in srgb, var(--border-color) 20%, transparent)',
              gap: 2
            }}>
              {[
                { label: '3px', val: 3 },
                { label: '4.5px', val: 4.5 },
                { label: '6px', val: 6 }
              ].map((w) => (
                <button
                  key={w.val}
                  type="button"
                  onClick={() => setChartStrokeWidth(w.val)}
                  title={`Set line width to ${w.label}`}
                  style={{
                    padding: '3px 8px',
                    fontSize: 10.5,
                    fontFamily: 'var(--font-mono)',
                    fontWeight: chartStrokeWidth === w.val ? 600 : 400,
                    borderRadius: 6,
                    border: 'none',
                    background: chartStrokeWidth === w.val ? 'rgba(56, 189, 248, 0.18)' : 'transparent',
                    color: chartStrokeWidth === w.val ? '#38bdf8' : 'var(--text-muted)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {w.label}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11.5, color: 'var(--text-muted)' }}>
              <span style={{
                width: 16,
                height: 3.5,
                borderRadius: 2,
                background: isNetProfit ? '#38bdf8' : '#f43f5e',
                boxShadow: `0 0 8px ${isNetProfit ? 'rgba(56, 189, 248, 0.6)' : 'rgba(244, 63, 94, 0.6)'}`
              }} />
              Net Trajectory
            </div>
            <span style={{
              fontSize: 14.5,
              fontWeight: 600,
              fontFamily: 'var(--font-mono)',
              color: isNetProfit ? '#38bdf8' : '#f43f5e',
              background: 'var(--bg-primary)',
              padding: '5px 14px',
              borderRadius: 8,
              border: `1px solid ${isNetProfit ? 'rgba(56, 189, 248, 0.25)' : 'rgba(244, 63, 94, 0.25)'}`,
              boxShadow: `0 2px 8px ${isNetProfit ? 'rgba(56, 189, 248, 0.08)' : 'rgba(244, 63, 94, 0.08)'}`
            }}>
              {formatCurrency(metrics.netPnL)}
            </span>
          </div>
        </div>

        {/* Chart Canvas with expanded width and height */}
        <div style={{ width: '100%', height: 310, position: 'relative' }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={displayChartData} margin={{ top: 16, right: 18, left: 6, bottom: 6 }}>
              <defs>
                {/* Radiant Ambient Aura Bloom Gradient */}
                <linearGradient id="auraBloomGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={isNetProfit ? '#38bdf8' : '#f43f5e'} stopOpacity={0.36} />
                  <stop offset="35%" stopColor={isNetProfit ? '#0ea5e9' : '#e11d48'} stopOpacity={0.16} />
                  <stop offset="70%" stopColor={isNetProfit ? '#0284c7' : '#be123c'} stopOpacity={0.04} />
                  <stop offset="100%" stopColor={isNetProfit ? '#0284c7' : '#be123c'} stopOpacity={0.00} />
                </linearGradient>
              </defs>

              {/* Minimalist soft atmospheric grid */}
              <CartesianGrid
                strokeDasharray="4 4"
                stroke="var(--border-color)"
                vertical={false}
                opacity={0.04}
              />

              <XAxis
                dataKey="date"
                stroke="var(--text-muted)"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                dy={6}
                tick={{ fill: 'var(--text-muted)', fontSize: 11, fontFamily: 'var(--font-mono)' }}
              />

              <YAxis
                width={56}
                stroke="var(--text-muted)"
                fontSize={10.5}
                tickLine={false}
                axisLine={false}
                dx={-4}
                tick={{ fill: 'var(--text-muted)', fontSize: 10.5, fontFamily: 'var(--font-mono)' }}
                tickFormatter={(val) => Math.abs(val) >= 1000 ? `₹${(val / 1000).toFixed(1)}k` : `₹${val}`}
              />

              {/* Apple Stocks / TradingView Glassmorphic Tooltip */}
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload || !payload.length) return null;
                  const dataPoint = payload[0].payload;
                  const val = dataPoint.actualPnL !== undefined ? dataPoint.actualPnL : dataPoint.cumulativePnL;
                  const isPositive = val >= 0;
                  const color = isPositive ? '#38bdf8' : '#f43f5e';
                  const dateText = dataPoint.tooltipDate || label || dataPoint.date;
                  return (
                    <div style={{
                      background: 'rgba(15, 23, 42, 0.90)',
                      backdropFilter: 'blur(16px)',
                      WebkitBackdropFilter: 'blur(16px)',
                      border: `1px solid ${isPositive ? 'rgba(56, 189, 248, 0.3)' : 'rgba(244, 63, 94, 0.3)'}`,
                      borderRadius: 12,
                      padding: '10px 14px',
                      boxShadow: `0 12px 28px rgba(0, 0, 0, 0.45), 0 0 20px ${isPositive ? 'rgba(56, 189, 248, 0.15)' : 'rgba(244, 63, 94, 0.15)'}`,
                      minWidth: 145,
                      pointerEvents: 'none'
                    }}>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginBottom: 4 }}>
                        {dateText}
                      </div>
                      <div style={{
                        fontSize: 16,
                        fontWeight: 700,
                        fontFamily: 'var(--font-mono)',
                        color: color,
                        letterSpacing: '-0.02em',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4
                      }}>
                        {formatCurrency(val)}
                      </div>
                      <div style={{
                        fontSize: 10,
                        fontWeight: 600,
                        letterSpacing: '0.04em',
                        color: 'rgba(255, 255, 255, 0.5)',
                        marginTop: 4,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4
                      }}>
                        <span style={{ width: 5, height: 5, borderRadius: '50%', background: color }} />
                        Cumulative Strategy Equity
                      </div>
                    </div>
                  );
                }}
              />

              {/* Bold Ambient Aura Area Curve with custom width & Beacon Peak Dot */}
              <Area
                type="monotone"
                dataKey="cumulativePnL"
                stroke={isNetProfit ? '#38bdf8' : '#f43f5e'}
                strokeWidth={chartStrokeWidth}
                strokeLinecap="round"
                strokeLinejoin="round"
                fillOpacity={1}
                fill="url(#auraBloomGradient)"
                style={{
                  filter: `drop-shadow(0 4px 12px ${isNetProfit ? 'rgba(56, 189, 248, 0.45)' : 'rgba(244, 63, 94, 0.45)'})`
                }}
                dot={(props) => {
                  if (props.index !== displayChartData.length - 1) return null;
                  const { cx, cy } = props;
                  if (cx === undefined || cy === undefined) return null;
                  const beaconColor = isNetProfit ? '#38bdf8' : '#f43f5e';
                  return (
                    <g key={`beacon-peak-${cx}-${cy}`} style={{ pointerEvents: 'none' }}>
                      <circle cx={cx} cy={cy} r={14} fill={beaconColor} fillOpacity={0.2} />
                      <circle cx={cx} cy={cy} r={8} fill={beaconColor} fillOpacity={0.45} />
                      <circle
                        cx={cx}
                        cy={cy}
                        r={4.5}
                        fill={beaconColor}
                        stroke="#ffffff"
                        strokeWidth={2}
                        style={{ filter: `drop-shadow(0 0 8px ${beaconColor})` }}
                      />
                    </g>
                  );
                }}
                activeDot={{
                  r: 6.5,
                  strokeWidth: 2.5,
                  stroke: '#ffffff',
                  fill: isNetProfit ? '#38bdf8' : '#f43f5e',
                  style: { filter: `drop-shadow(0 0 10px ${isNetProfit ? '#38bdf8' : '#f43f5e'})` }
                }}
                isAnimationActive={true}
                animationDuration={1200}
                animationEasing="ease-out"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Cost of Indiscipline Callout ──────────────────────────────────── */}
      <div style={{
        background: 'var(--bg-surface)',
        border: '1px solid color-mix(in srgb, var(--border-color) 25%, transparent)',
        borderRadius: 16,
        padding: '24px 28px',
        display: 'flex',
        flexDirection: 'column',
        gap: 18
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <h3 style={{
              fontSize: 16.5,
              fontWeight: 600,
              color: 'var(--text-primary)',
              margin: 0
            }}>
              Cost of Indiscipline Breakdown
            </h3>
            <SectionInfoTooltip tooltip="Strict Checklist Execution vs Rule Violations & Impulse Trades: Quantifies financial bleed caused by deviating from defined trading rules." />
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '6px 14px',
            borderRadius: 8,
            background: 'var(--bg-primary)',
            border: '1px solid color-mix(in srgb, var(--border-color) 25%, transparent)'
          }}>
            <span style={{ fontSize: 11, fontWeight: 450, color: 'var(--text-muted)', letterSpacing: '0.02em' }}>
              Undisciplined Bleed:
            </span>
            <span style={{
              fontSize: 14.5,
              fontWeight: 500,
              fontFamily: 'var(--font-mono)',
              color: indiscipline.undisciplinedBleed > 0 ? '#ef4444' : '#10b981'
            }}>
              {formatBleed(indiscipline.undisciplinedBleed)}
            </span>
          </div>
        </div>

        {/* Visual Segmented Adherence Ratio Bar */}
        {(() => {
          const totalDisciplineTrades =
            (indiscipline.disciplined.count || 0) +
            (indiscipline.compromised.count || 0) +
            (indiscipline.impulse.count || 0);

          const discPct = totalDisciplineTrades > 0 ? (indiscipline.disciplined.count / totalDisciplineTrades) * 100 : 100;
          const compPct = totalDisciplineTrades > 0 ? (indiscipline.compromised.count / totalDisciplineTrades) * 100 : 0;
          const impPct = totalDisciplineTrades > 0 ? (indiscipline.impulse.count / totalDisciplineTrades) * 100 : 0;

          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11.5, color: 'var(--text-muted)' }}>
                <span style={{ fontWeight: 450, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 12, height: 2, borderRadius: 1, background: '#10b981', display: 'inline-block' }} />
                  Playbook Rule Execution Split
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 500, color: 'var(--text-primary)' }}>
                  {totalDisciplineTrades > 0 ? `${Math.round(discPct)}% Strict Adherence` : '100% Strict Adherence'}
                </span>
              </div>
              <div style={{
                display: 'flex',
                height: 6,
                width: '100%',
                borderRadius: 6,
                overflow: 'hidden',
                background: 'var(--bg-primary)',
                border: '1px solid color-mix(in srgb, var(--border-color) 20%, transparent)',
                gap: 2,
                padding: 1
              }}>
                {discPct > 0 && (
                  <div
                    style={{
                      width: `${discPct}%`,
                      background: '#10b981',
                      borderRadius: 3,
                      transition: 'width 0.8s cubic-bezier(0.16, 1, 0.3, 1)'
                    }}
                    title={`Disciplined (100% Rules): ${indiscipline.disciplined.count} trades (${Math.round(discPct)}%)`}
                  />
                )}
                {compPct > 0 && (
                  <div
                    style={{
                      width: `${compPct}%`,
                      background: '#f59e0b',
                      borderRadius: 3,
                      transition: 'width 0.8s cubic-bezier(0.16, 1, 0.3, 1)'
                    }}
                    title={`Compromised (<100% Rules): ${indiscipline.compromised.count} trades (${Math.round(compPct)}%)`}
                  />
                )}
                {impPct > 0 && (
                  <div
                    style={{
                      width: `${impPct}%`,
                      background: '#ef4444',
                      borderRadius: 3,
                      transition: 'width 0.8s cubic-bezier(0.16, 1, 0.3, 1)'
                    }}
                    title={`No Setup / Impulse: ${indiscipline.impulse.count} trades (${Math.round(impPct)}%)`}
                  />
                )}
              </div>
            </div>
          );
        })()}

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 20
        }}>
          {/* 100% Rules Followed */}
          <div style={{
            padding: '18px 20px',
            borderRadius: 12,
            border: '1px solid color-mix(in srgb, var(--border-color) 20%, transparent)',
            borderLeft: '3px solid #10b981',
            background: 'rgba(16,185,129,0.02)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 12.5, fontWeight: 550, color: '#10b981' }}>
                100% Rules Followed
              </span>
              <span style={{ fontSize: 11, fontWeight: 450, color: 'var(--text-muted)' }}>
                {indiscipline.disciplined.count} Trades
              </span>
            </div>
            <div style={{ fontSize: 18, fontWeight: 600, fontFamily: 'var(--font-mono)', color: indiscipline.disciplined.pnl >= 0 ? '#10b981' : '#ef4444' }}>
              {formatCurrency(indiscipline.disciplined.pnl)}
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 6 }}>
              Win Rate: <strong style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{indiscipline.disciplined.winRate}%</strong>
            </div>
          </div>

          {/* < 100% Rules Followed */}
          <div style={{
            padding: '18px 20px',
            borderRadius: 12,
            border: '1px solid color-mix(in srgb, var(--border-color) 20%, transparent)',
            borderLeft: '3px solid #f59e0b',
            background: 'rgba(245,158,11,0.02)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 12.5, fontWeight: 550, color: '#f59e0b' }}>
                Rules Violated (&lt;100%)
              </span>
              <span style={{ fontSize: 11, fontWeight: 450, color: 'var(--text-muted)' }}>
                {indiscipline.compromised.count} Trades
              </span>
            </div>
            <div style={{ fontSize: 18, fontWeight: 600, fontFamily: 'var(--font-mono)', color: indiscipline.compromised.pnl >= 0 ? '#10b981' : '#ef4444' }}>
              {formatCurrency(indiscipline.compromised.pnl)}
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 6 }}>
              Win Rate: <strong style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{indiscipline.compromised.winRate}%</strong>
            </div>
          </div>

          {/* No Setup / Impulse */}
          <div style={{
            padding: '18px 20px',
            borderRadius: 12,
            border: '1px solid color-mix(in srgb, var(--border-color) 20%, transparent)',
            borderLeft: '3px solid #ef4444',
            background: 'rgba(239,68,68,0.02)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 12.5, fontWeight: 550, color: '#ef4444' }}>
                No Setup / Impulse
              </span>
              <span style={{ fontSize: 11, fontWeight: 450, color: 'var(--text-muted)' }}>
                {indiscipline.impulse.count} Trades
              </span>
            </div>
            <div style={{ fontSize: 18, fontWeight: 600, fontFamily: 'var(--font-mono)', color: indiscipline.impulse.pnl >= 0 ? '#10b981' : '#ef4444' }}>
              {formatCurrency(indiscipline.impulse.pnl)}
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 6 }}>
              Win Rate: <strong style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{indiscipline.impulse.winRate}%</strong>
            </div>
          </div>
        </div>
      </div>

      {/* ── Trade Outcome & R-Multiple Return Distribution (Histogram) ──── */}
      {(() => {
        const sampleRBuckets = [
          { label: '< -2R', count: 0, pnl: 0, color: '#ef4444' },
          { label: '-2R to -1R', count: 1, pnl: -3500, color: '#f87171' },
          { label: '-1R to 0R', count: 2, pnl: -2800, color: '#fb923c' },
          { label: '0R (BE)', count: 1, pnl: 0, color: '#94a3b8' },
          { label: '+0.1R to +1R', count: 3, pnl: 7200, color: '#86efac' },
          { label: '+1R to +2R', count: 4, pnl: 18400, color: '#34d399' },
          { label: '> +2R', count: 2, pnl: 16000, color: '#10b981' }
        ];

        const samplePnLBuckets = [
          { label: '< -₹10k', count: 0, pnl: 0, color: '#ef4444' },
          { label: '-₹10k to -₹2k', count: 1, pnl: -4000, color: '#f87171' },
          { label: '-₹2k to ₹0', count: 2, pnl: -2300, color: '#fb923c' },
          { label: '₹0 to +₹2k', count: 3, pnl: 3400, color: '#86efac' },
          { label: '+₹2k to +₹10k', count: 5, pnl: 22800, color: '#34d399' },
          { label: '> +₹10k', count: 2, pnl: 28000, color: '#10b981' }
        ];

        const hasRealData = (distribution?.rBuckets && distribution.rBuckets.some(b => b.count > 0)) ||
          (distribution?.pnlBuckets && distribution.pnlBuckets.some(b => b.count > 0));

        const activeR = hasRealData ? (distribution.rBuckets || sampleRBuckets) : sampleRBuckets;
        const activePnL = hasRealData ? (distribution.pnlBuckets || samplePnLBuckets) : samplePnLBuckets;
        const currentData = histogramMode === 'rMultiple' ? activeR : activePnL;

        return (
          <div style={{
            background: 'var(--bg-surface)',
            border: '1px solid color-mix(in srgb, var(--border-color) 25%, transparent)',
            borderRadius: 16,
            padding: '24px 28px',
            display: 'flex',
            flexDirection: 'column',
            gap: 20
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <h3 style={{
                  fontSize: 16.5,
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  margin: 0
                }}>
                  Realized Return Distribution
                </h3>
                <SectionInfoTooltip tooltip="Return Spread & Expectancy Skew: Statistical distribution of trade outcomes categorized by R-Multiple return and net realized P&L." />
              </div>

              {/* Metric Toggle Tabs */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                background: 'var(--bg-primary)',
                border: '1px solid color-mix(in srgb, var(--border-color) 25%, transparent)',
                borderRadius: 10,
                padding: 3,
                gap: 4
              }}>
                <button
                  onClick={() => setHistogramMode('rMultiple')}
                  style={{
                    padding: '5px 13px',
                    borderRadius: 7,
                    fontSize: 11.5,
                    fontWeight: histogramMode === 'rMultiple' ? 600 : 450,
                    border: histogramMode === 'rMultiple'
                      ? '1px solid color-mix(in srgb, var(--border-color) 35%, transparent)'
                      : '1px solid transparent',
                    background: histogramMode === 'rMultiple'
                      ? 'color-mix(in srgb, var(--text-primary) 9%, var(--bg-surface))'
                      : 'transparent',
                    color: histogramMode === 'rMultiple' ? 'var(--text-primary)' : 'var(--text-muted)',
                    cursor: 'pointer',
                    transition: 'all 0.18s ease'
                  }}
                >
                  R-Multiple Return
                </button>
                <button
                  onClick={() => setHistogramMode('pnl')}
                  style={{
                    padding: '5px 13px',
                    borderRadius: 7,
                    fontSize: 11.5,
                    fontWeight: histogramMode === 'pnl' ? 600 : 450,
                    border: histogramMode === 'pnl'
                      ? '1px solid color-mix(in srgb, var(--border-color) 35%, transparent)'
                      : '1px solid transparent',
                    background: histogramMode === 'pnl'
                      ? 'color-mix(in srgb, var(--text-primary) 9%, var(--bg-surface))'
                      : 'transparent',
                    color: histogramMode === 'pnl' ? 'var(--text-primary)' : 'var(--text-muted)',
                    cursor: 'pointer',
                    transition: 'all 0.18s ease'
                  }}
                >
                  Realized P&amp;L (₹)
                </button>
              </div>
            </div>

            {/* Histogram Chart */}
            <div style={{ width: '100%', height: 250 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={currentData}
                  margin={{ top: 12, right: 16, left: 0, bottom: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} opacity={0.07} />
                  <XAxis
                    dataKey="label"
                    stroke="var(--text-muted)"
                    fontSize={11}
                    tickLine={false}
                    axisLine={{ stroke: 'color-mix(in srgb, var(--border-color) 20%, transparent)' }}
                  />
                  <YAxis
                    width={48}
                    allowDecimals={false}
                    stroke="var(--text-muted)"
                    fontSize={10.5}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload || !payload.length) return null;
                      const item = payload[0].payload;
                      return (
                        <div style={{
                          background: 'var(--bg-card)',
                          backdropFilter: 'blur(12px)',
                          border: '1px solid color-mix(in srgb, var(--border-color) 30%, transparent)',
                          borderRadius: 10,
                          padding: '10px 14px',
                          boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                          fontSize: 12,
                          minWidth: 150
                        }}>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
                            Bucket: {item.label}
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, color: 'var(--text-muted)' }}>
                            <span>Frequency:</span>
                            <strong style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontWeight: 500 }}>
                              {item.count} {item.count === 1 ? 'trade' : 'trades'}
                            </strong>
                          </div>
                          {item.pnl !== undefined && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, color: 'var(--text-muted)', marginTop: 3 }}>
                              <span>Realized P&amp;L:</span>
                              <strong style={{ color: item.pnl >= 0 ? '#10b981' : '#ef4444', fontFamily: 'var(--font-mono)', fontWeight: 500 }}>
                                {formatCurrency(item.pnl)}
                              </strong>
                            </div>
                          )}
                        </div>
                      );
                    }}
                  />
                  <Bar
                    dataKey="count"
                    barSize={24}
                    radius={[4, 4, 0, 0]}
                    isAnimationActive={true}
                    animationDuration={850}
                    animationEasing="ease-out"
                  >
                    {currentData.map((entry, index) => (
                      <Cell key={`hist-cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Statistical Skew Badges */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: 12,
              paddingTop: 12,
              borderTop: '1px solid color-mix(in srgb, var(--border-color) 20%, transparent)'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 14px',
                background: 'color-mix(in srgb, var(--text-primary) 3%, var(--bg-surface))',
                borderRadius: 10,
                border: '1px solid color-mix(in srgb, var(--border-color) 20%, transparent)',
                fontSize: 12
              }}>
                <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <ArrowUpRight size={14} color="#10b981" /> Right-Tail (&gt;+1R)
                </span>
                <strong style={{ color: '#10b981', fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 500 }}>
                  {activeR.slice(5).reduce((acc, b) => acc + b.count, 0)} trades
                </strong>
              </div>

              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 14px',
                background: 'color-mix(in srgb, var(--text-primary) 3%, var(--bg-surface))',
                borderRadius: 10,
                border: '1px solid color-mix(in srgb, var(--border-color) 20%, transparent)',
                fontSize: 12
              }}>
                <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <ArrowDownRight size={14} color="#ef4444" /> Left-Tail (&lt;-1R)
                </span>
                <strong style={{
                  color: activeR.slice(0, 2).reduce((acc, b) => acc + b.count, 0) === 0 ? '#10b981' : '#ef4444',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 13,
                  fontWeight: 500
                }}>
                  {activeR.slice(0, 2).reduce((acc, b) => acc + b.count, 0)} trades
                </strong>
              </div>

              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 14px',
                background: 'color-mix(in srgb, var(--text-primary) 3%, var(--bg-surface))',
                borderRadius: 10,
                border: '1px solid color-mix(in srgb, var(--border-color) 20%, transparent)',
                fontSize: 12
              }}>
                <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <CheckCircle2 size={14} color="#94a3b8" /> Breakeven
                </span>
                <strong style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 500 }}>
                  {activeR[3]?.count || 0} trades
                </strong>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Dual Side-by-Side Vertical Bar Charts ── */}
      {(() => {
        const defaultDaily = [
          { day: 'Sun', dayName: 'Sunday', trades: 0, wins: 0, pnl: 0, winRate: 0 },
          { day: 'Mon', dayName: 'Monday', trades: 3, wins: 2, pnl: 8500, winRate: 67 },
          { day: 'Tue', dayName: 'Tuesday', trades: 4, wins: 3, pnl: 14200, winRate: 75 },
          { day: 'Wed', dayName: 'Wednesday', trades: 2, wins: 1, pnl: -3500, winRate: 50 },
          { day: 'Thu', dayName: 'Thursday', trades: 5, wins: 4, pnl: 22400, winRate: 80 },
          { day: 'Fri', dayName: 'Friday', trades: 2, wins: 0, pnl: -6800, winRate: 0 },
          { day: 'Sat', dayName: 'Saturday', trades: 0, wins: 0, pnl: 0, winRate: 0 }
        ];

        const defaultSessions = [
          { session: 'Morning Open', label: 'Morning Open (9:15 - 10:30)', timeRange: '09:15 - 10:30 IST', trades: 6, wins: 5, pnl: 28400, winRate: 83 },
          { session: 'Mid-Day', label: 'Mid-Day Session (10:30 - 1:30)', timeRange: '10:30 - 13:30 IST', trades: 4, wins: 1, pnl: -7200, winRate: 25 },
          { session: 'Closing Drive', label: 'Closing Drive (1:30 - 3:30)', timeRange: '13:30 - 15:30 IST', trades: 6, wins: 4, pnl: 13600, winRate: 67 }
        ];

        const hasDailyTrades = distribution?.dailyDistribution && distribution.dailyDistribution.some(d => d.trades > 0);
        const dailyChartData = hasDailyTrades ? distribution.dailyDistribution : defaultDaily;

        const hasSessionTrades = distribution?.sessions && distribution.sessions.some(s => s.trades > 0);
        const sessionChartData = hasSessionTrades ? distribution.sessions : defaultSessions;

        return (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))',
            gap: 24
          }}>
            {/* Card 1: Aggregate PnL vs Day */}
            <div style={{
              background: 'var(--bg-surface)',
              border: '1px solid color-mix(in srgb, var(--border-color) 25%, transparent)',
              borderRadius: 16,
              padding: '24px 28px',
              display: 'flex',
              flexDirection: 'column',
              gap: 16
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <h3 style={{
                    fontSize: 16.5,
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    margin: 0
                  }}>
                    Aggregate PnL vs Day
                  </h3>
                  <SectionInfoTooltip tooltip="Weekday Distribution: Compares cumulative profitability and win rates across days of the week." />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 11.5, color: 'var(--text-muted)' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#10b981' }} />
                    Profit
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#ef4444' }} />
                    Loss
                  </span>
                </div>
              </div>

              <div style={{ width: '100%', height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dailyChartData} margin={{ top: 12, right: 16, left: 0, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} opacity={0.07} />
                    <XAxis
                      dataKey="dayName"
                      stroke="var(--text-muted)"
                      fontSize={11}
                      tickLine={false}
                      axisLine={{ stroke: 'color-mix(in srgb, var(--border-color) 20%, transparent)' }}
                    />
                    <YAxis
                      width={48}
                      stroke="var(--text-muted)"
                      fontSize={10.5}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(val) => Math.abs(val) >= 1000 ? `₹${(val / 1000).toFixed(0)}k` : `₹${val}`}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload || !payload.length) return null;
                        const item = payload[0].payload;
                        const isProfitable = item.pnl >= 0;
                        return (
                          <div style={{
                            background: 'var(--bg-card)',
                            backdropFilter: 'blur(12px)',
                            border: '1px solid color-mix(in srgb, var(--border-color) 30%, transparent)',
                            borderRadius: 10,
                            padding: '10px 14px',
                            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                            fontSize: 12,
                            minWidth: 160
                          }}>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
                              {item.dayName || item.day}
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, color: 'var(--text-muted)' }}>
                              <span>Total P&amp;L:</span>
                              <strong style={{ color: isProfitable ? '#10b981' : '#ef4444', fontFamily: 'var(--font-mono)', fontWeight: 500 }}>
                                {formatCurrency(item.pnl)}
                              </strong>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                              <span>Trades:</span>
                              <strong style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontWeight: 500 }}>
                                {item.trades}
                              </strong>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                              <span>Win Rate:</span>
                              <strong style={{
                                color: item.winRate >= 60 ? '#10b981' : item.trades > 0 ? '#f59e0b' : 'var(--text-muted)',
                                fontFamily: 'var(--font-mono)',
                                fontWeight: 500
                              }}>
                                {item.trades > 0 ? `${item.winRate}%` : '—'}
                              </strong>
                            </div>
                          </div>
                        );
                      }}
                    />
                    <ReferenceLine y={0} stroke="color-mix(in srgb, var(--border-color) 35%, transparent)" strokeWidth={1} strokeDasharray="2 2" />
                    <Bar
                      dataKey="pnl"
                      barSize={20}
                      radius={[4, 4, 4, 4]}
                      isAnimationActive={true}
                      animationDuration={850}
                      animationEasing="ease-out"
                    >
                      {dailyChartData.map((entry, idx) => (
                        <Cell
                          key={`day-bar-${idx}`}
                          fill={entry.pnl > 0 ? '#10b981' : entry.pnl < 0 ? '#ef4444' : 'rgba(255,255,255,0.06)'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Card 2: Aggregate PnL vs Market Session */}
            <div style={{
              background: 'var(--bg-surface)',
              border: '1px solid color-mix(in srgb, var(--border-color) 25%, transparent)',
              borderRadius: 16,
              padding: '24px 28px',
              display: 'flex',
              flexDirection: 'column',
              gap: 16
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <h3 style={{
                    fontSize: 16.5,
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    margin: 0
                  }}>
                    Aggregate PnL vs Market Session
                  </h3>
                  <SectionInfoTooltip tooltip="Intraday Sessions (IST): Analyzes performance across Morning Open (9:15 - 10:30), Mid-Day (10:30 - 1:30), and Closing Drive (1:30 - 3:30)." />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 11.5, color: 'var(--text-muted)' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#10b981' }} />
                    Profit
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#ef4444' }} />
                    Loss
                  </span>
                </div>
              </div>

              <div style={{ width: '100%', height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={sessionChartData} margin={{ top: 12, right: 16, left: 0, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} opacity={0.07} />
                    <XAxis
                      dataKey="session"
                      stroke="var(--text-muted)"
                      fontSize={11}
                      tickLine={false}
                      axisLine={{ stroke: 'color-mix(in srgb, var(--border-color) 20%, transparent)' }}
                    />
                    <YAxis
                      width={48}
                      stroke="var(--text-muted)"
                      fontSize={10.5}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(val) => Math.abs(val) >= 1000 ? `₹${(val / 1000).toFixed(0)}k` : `₹${val}`}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload || !payload.length) return null;
                        const item = payload[0].payload;
                        const isProfitable = item.pnl >= 0;
                        return (
                          <div style={{
                            background: 'var(--bg-card)',
                            backdropFilter: 'blur(12px)',
                            border: '1px solid color-mix(in srgb, var(--border-color) 30%, transparent)',
                            borderRadius: 10,
                            padding: '10px 14px',
                            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                            fontSize: 12,
                            minWidth: 170
                          }}>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>
                              {item.session || item.label}
                            </div>
                            {item.timeRange && (
                              <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginBottom: 6 }}>
                                {item.timeRange}
                              </div>
                            )}
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, color: 'var(--text-muted)' }}>
                              <span>Total P&amp;L:</span>
                              <strong style={{ color: isProfitable ? '#10b981' : '#ef4444', fontFamily: 'var(--font-mono)', fontWeight: 500 }}>
                                {formatCurrency(item.pnl)}
                              </strong>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                              <span>Trades:</span>
                              <strong style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontWeight: 500 }}>
                                {item.trades}
                              </strong>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                              <span>Win Rate:</span>
                              <strong style={{
                                color: item.winRate >= 60 ? '#10b981' : item.trades > 0 ? '#f59e0b' : 'var(--text-muted)',
                                fontFamily: 'var(--font-mono)',
                                fontWeight: 500
                              }}>
                                {item.trades > 0 ? `${item.winRate}%` : '—'}
                              </strong>
                            </div>
                          </div>
                        );
                      }}
                    />
                    <ReferenceLine y={0} stroke="color-mix(in srgb, var(--border-color) 35%, transparent)" strokeWidth={1} strokeDasharray="2 2" />
                    <Bar
                      dataKey="pnl"
                      barSize={24}
                      radius={[4, 4, 4, 4]}
                      isAnimationActive={true}
                      animationDuration={850}
                      animationEasing="ease-out"
                    >
                      {sessionChartData.map((entry, idx) => (
                        <Cell
                          key={`session-bar-${idx}`}
                          fill={entry.pnl > 0 ? '#10b981' : entry.pnl < 0 ? '#ef4444' : 'rgba(255,255,255,0.06)'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── AI Pattern Recognition & Execution Insights ───────────────────── */}
      <div style={{
        background: 'var(--bg-surface)',
        border: '1px solid color-mix(in srgb, var(--border-color) 25%, transparent)',
        borderRadius: 16,
        padding: '24px 28px',
        display: 'flex',
        flexDirection: 'column',
        gap: 18
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <h3 style={{
              fontSize: 16.5,
              fontWeight: 600,
              color: 'var(--text-primary)',
              margin: 0
            }}>
              AI Pattern Recognition &amp; Execution Insights
            </h3>
            <SectionInfoTooltip tooltip="Automated Heuristic Analysis & Edge Leakage Detection: Intelligent diagnosis of setup decay, execution discipline, and win rate leaks." />
          </div>

          {/* Export Action Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              onClick={() => exportPlaybookToCSV(playbook, metrics.pbTrades, tradeAudits)}
              title="Export Playbook Performance Report to CSV"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '7px 14px',
                borderRadius: 8,
                border: '1px solid color-mix(in srgb, var(--border-color) 25%, transparent)',
                background: 'var(--bg-primary)',
                color: 'var(--text-primary)',
                fontSize: 11.5,
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'background 0.15s ease'
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-card)'}
              onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-primary)'}
            >
              <FileSpreadsheet size={13} />
              <span>Export CSV</span>
            </button>

            <button
              onClick={() => exportPlaybookToJSON(playbook)}
              title="Export Playbook Definition & Rules to JSON"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '7px 14px',
                borderRadius: 8,
                border: '1px solid color-mix(in srgb, var(--border-color) 25%, transparent)',
                background: 'var(--bg-primary)',
                color: 'var(--text-primary)',
                fontSize: 11.5,
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'background 0.15s ease'
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-card)'}
              onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-primary)'}
            >
              <FileCode size={13} />
              <span>Export JSON</span>
            </button>
          </div>
        </div>

        {/* AI Insight Cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 16
        }}>
          {aiInsights.map(insight => (
            <div
              key={insight.id}
              style={{
                padding: '18px 20px',
                borderRadius: 12,
                border: '1px solid color-mix(in srgb, var(--border-color) 20%, transparent)',
                borderLeft: insight.type === 'positive' ? '3px solid #10b981' : insight.type === 'warning' ? '3px solid #f59e0b' : '3px solid var(--border-color)',
                background: 'var(--bg-primary)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: 10
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 10.5, fontWeight: 450, color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
                    {insight.category}
                  </span>
                  <span style={{
                    fontSize: 10,
                    fontWeight: 500,
                    fontFamily: 'var(--font-mono)',
                    padding: '2px 8px',
                    borderRadius: 5,
                    border: '1px solid color-mix(in srgb, var(--border-color) 20%, transparent)',
                    background: insight.type === 'positive' ? 'rgba(16,185,129,0.08)' : insight.type === 'warning' ? 'rgba(245,158,11,0.08)' : 'var(--bg-surface)',
                    color: insight.type === 'positive' ? '#10b981' : insight.type === 'warning' ? '#f59e0b' : 'var(--text-secondary)'
                  }}>
                    {insight.badge}
                  </span>
                </div>
                <div style={{ fontSize: 13.5, fontWeight: 550, color: 'var(--text-primary)', marginBottom: 6 }}>
                  {insight.title}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.55 }}>
                  {insight.description}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
