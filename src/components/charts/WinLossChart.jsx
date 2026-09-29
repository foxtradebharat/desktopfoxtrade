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

const DEFAULT_MOCK_WIN_LOSS = {
  winCount: 5,
  lossCount: 2,
  winRate: 71.4,
  avgWin: 7590,
  avgLoss: 2790,
  profitFactor: 6.8
};

export default function WinLossChart({
  data,
  trades,
  height = 260,
  hideValues = false,
  mode = 'payoff' // 'payoff' (Avg Win vs Avg Loss) | 'counts' (Win vs Loss count)
}) {
  // Compute win/loss metrics if raw trades provided
  const metrics = useMemo(() => {
    if (data && typeof data.winRate === 'number') return data;
    if (!trades || trades.length === 0) return DEFAULT_MOCK_WIN_LOSS;

    let wins = 0;
    let losses = 0;
    let totalWinVal = 0;
    let totalLossVal = 0;

    trades
      .filter((t) => t.status === 'Closed')
      .forEach((t) => {
        const net = Number(t.netPnl ?? t.pl ?? t.pnl ?? 0);
        if (net > 0) {
          wins++;
          totalWinVal += net;
        } else if (net < 0) {
          losses++;
          totalLossVal += Math.abs(net);
        }
      });

    const totalClosed = wins + losses;
    const winRate = totalClosed > 0 ? (wins / totalClosed) * 100 : 0;
    const avgWin = wins > 0 ? totalWinVal / wins : 0;
    const avgLoss = losses > 0 ? totalLossVal / losses : 0;
    const profitFactor = totalLossVal > 0 ? totalWinVal / totalLossVal : wins > 0 ? 99 : 0;

    return {
      winCount: wins,
      lossCount: losses,
      winRate: Math.round(winRate * 10) / 10,
      avgWin: Math.round(avgWin),
      avgLoss: Math.round(avgLoss),
      profitFactor: Math.round(profitFactor * 100) / 100
    };
  }, [data, trades]);

  // Chart data points
  const chartData = useMemo(() => {
    if (mode === 'counts') {
      return [
        { label: 'Winning Trades', value: metrics.winCount, color: '#10b981' },
        { label: 'Losing Trades', value: metrics.lossCount, color: '#ef4444' }
      ];
    }
    return [
      { label: 'Avg Win', value: metrics.avgWin, color: '#10b981' },
      { label: 'Avg Loss', value: -metrics.avgLoss, color: '#ef4444' }
    ];
  }, [metrics, mode]);

  const formatYAxis = (val) => {
    if (hideValues) return '••••';
    if (mode === 'counts') return val;
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
          margin={{ top: 12, right: 16, left: 10, bottom: 6 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color, #f1f5f9)" vertical={false} />

          <XAxis
            dataKey="label"
            stroke="var(--text-muted, #9ca3af)"
            fontSize={11}
            tickLine={false}
            axisLine={{ stroke: 'var(--border-color, #e5e7eb)' }}
          />

          <YAxis
            width={52}
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
                unit={mode === 'counts' ? 'trades' : '₹'}
                hideValues={hideValues}
              />
            }
          />

          <Bar
            dataKey="value"
            name={mode === 'counts' ? 'Count' : 'Amount'}
            maxBarSize={60}
            radius={[6, 6, 0, 0]}
            isAnimationActive={true}
            animationDuration={800}
            animationEasing="ease-out"
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
