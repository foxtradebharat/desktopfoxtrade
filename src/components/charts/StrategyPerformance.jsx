import React, { useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine
} from 'recharts';
import ChartTooltip from './ChartTooltip';

const DEFAULT_MOCK_STRATEGIES = [
  { setup: 'High Tight Flag', trades: 4, winRate: 75.0, totalNetPnl: 18450, profitFactor: 4.2 },
  { setup: 'Base on Base', trades: 3, winRate: 66.7, totalNetPnl: 11200, profitFactor: 3.1 },
  { setup: 'VCP Breakout', trades: 2, winRate: 100.0, totalNetPnl: 8900, profitFactor: 8.9 },
  { setup: 'Pullback 20EMA', trades: 3, winRate: 33.3, totalNetPnl: -2100, profitFactor: 0.7 },
  { setup: 'Support Bounce', trades: 2, winRate: 50.0, totalNetPnl: 1420, profitFactor: 1.5 }
];

export default function StrategyPerformance({
  data,
  trades,
  height = 280,
  metric = 'pnl', // 'pnl' | 'winRate' | 'trades'
  hideValues = false
}) {
  // Aggregate setup performance from trades if provided
  const chartData = useMemo(() => {
    if (data && data.length > 0) return data;
    if (!trades || trades.length === 0) return DEFAULT_MOCK_STRATEGIES;

    const setupMap = {};
    trades
      .filter((t) => t.status === 'Closed')
      .forEach((t) => {
        const setupName = t.setup || t.strategy || 'Unassigned';
        if (!setupMap[setupName]) {
          setupMap[setupName] = { setup: setupName, trades: 0, wins: 0, netPnl: 0 };
        }
        setupMap[setupName].trades++;
        const net = Number(t.netPnl ?? t.pl ?? t.pnl ?? 0);
        setupMap[setupName].netPnl += net;
        if (net > 0) setupMap[setupName].wins++;
      });

    return Object.values(setupMap).map((s) => ({
      setup: s.setup,
      trades: s.trades,
      winRate: Math.round((s.wins / s.trades) * 1000) / 10,
      totalNetPnl: Math.round(s.netPnl),
      value: metric === 'winRate' ? Math.round((s.wins / s.trades) * 1000) / 10 : Math.round(s.netPnl)
    }));
  }, [data, trades, metric]);

  const formatYAxis = (val) => {
    if (hideValues) return '••••';
    if (metric === 'winRate') return `${val}%`;
    if (metric === 'trades') return val;
    const abs = Math.abs(val);
    if (abs >= 1000) return `₹${(val / 1000).toFixed(0)}k`;
    return `₹${val}`;
  };

  return (
    <div
      style={{
        width: '100%',
        height: typeof height === 'number' ? `${height}px` : height,
        position: 'relative'
      }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          margin={{ top: 12, right: 16, left: 10, bottom: 20 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color, #f1f5f9)" vertical={false} />

          <XAxis
            dataKey="setup"
            stroke="var(--text-muted, #9ca3af)"
            fontSize={11}
            tickLine={false}
            interval={0}
            angle={-15}
            textAnchor="end"
            axisLine={{ stroke: 'var(--border-color, #e5e7eb)' }}
          />

          <YAxis
            width={54}
            stroke="var(--text-muted, #9ca3af)"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            tickFormatter={formatYAxis}
          />

          <ReferenceLine y={0} stroke="var(--text-muted, #cbd5e1)" strokeWidth={1.2} />

          <Tooltip
            cursor={false}
            content={
              <ChartTooltip
                unit={metric === 'winRate' ? '%' : metric === 'trades' ? '' : '₹'}
                hideValues={hideValues}
              />
            }
          />

          <Bar
            dataKey={metric === 'winRate' ? 'winRate' : metric === 'trades' ? 'trades' : 'totalNetPnl'}
            name={metric === 'winRate' ? 'Win Rate' : metric === 'trades' ? 'Trades' : 'Net P&L'}
            maxBarSize={48}
            radius={[5, 5, 0, 0]}
            isAnimationActive={true}
            animationDuration={800}
            animationEasing="ease-out"
          >
            {chartData.map((entry, index) => {
              const val = metric === 'winRate' ? entry.winRate : entry.totalNetPnl;
              const isPositive = metric === 'winRate' ? val >= 50 : val >= 0;
              return (
                <Cell
                  key={`cell-${index}`}
                  fill={isPositive ? '#10b981' : '#ef4444'}
                />
              );
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
