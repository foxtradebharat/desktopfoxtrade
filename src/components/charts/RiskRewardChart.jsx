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

const DEFAULT_MOCK_RR = [
  { tradeNo: 1, symbol: 'RELIANCE', realizedR: -1.0, plannedRR: 2.5, pnl: -2790 },
  { tradeNo: 2, symbol: 'TCS', realizedR: 3.2, plannedRR: 2.5, pnl: 10500 },
  { tradeNo: 3, symbol: 'HDFCBANK', realizedR: 1.8, plannedRR: 2.0, pnl: 5700 },
  { tradeNo: 4, symbol: 'TATAMOTORS', realizedR: 0.0, plannedRR: 3.0, pnl: 0 },
  { tradeNo: 5, symbol: 'INFY', realizedR: 2.4, plannedRR: 2.5, pnl: 6420 },
  { tradeNo: 6, symbol: 'ICICIBANK', realizedR: -0.9, plannedRR: 2.0, pnl: -2000 },
  { tradeNo: 7, symbol: 'BHARTIARTL', realizedR: 3.5, plannedRR: 3.0, pnl: 10500 },
  { tradeNo: 8, symbol: 'SBIN', realizedR: 1.6, plannedRR: 2.0, pnl: 5000 }
];

export default function RiskRewardChart({
  data,
  trades,
  height = 280,
  hideValues = false
}) {
  // Compute R multiples from trades if provided
  const chartData = useMemo(() => {
    if (data && data.length > 0) return data;
    if (!trades || trades.length === 0) return DEFAULT_MOCK_RR;

    return trades
      .filter((t) => t.status === 'Closed')
      .map((t, idx) => {
        const net = Number(t.netPnl ?? t.pl ?? t.pnl ?? 0);
        const entry = Number(t.entry || t.avgEntry || 0);
        const sl = Number(t.sl || t.p1Sl || 0);
        const qty = Number(t.qty || t.initialQty || 1);

        let initialRisk = Math.abs(entry - sl) * qty;
        if (!initialRisk || initialRisk <= 0) initialRisk = 2500; // fallback reasonable 1R

        const realizedR = initialRisk > 0 ? Math.round((net / initialRisk) * 100) / 100 : 0;

        return {
          tradeNo: idx + 1,
          xLabel: `#${idx + 1} ${t.name || t.symbol || ''}`,
          symbol: t.name || t.symbol || `Trade #${idx + 1}`,
          realizedR,
          plannedRR: 2.5,
          pnl: net
        };
      });
  }, [data, trades]);

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
            dataKey="xLabel"
            stroke="var(--text-muted, #9ca3af)"
            fontSize={11}
            tickLine={false}
            axisLine={{ stroke: 'var(--border-color, #e5e7eb)' }}
          />

          <YAxis
            width={48}
            stroke="var(--text-muted, #9ca3af)"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            tickFormatter={(val) => (hideValues ? '••' : `${val}R`)}
          />

          <ReferenceLine y={0} stroke="var(--text-muted, #cbd5e1)" strokeWidth={1.2} />
          <ReferenceLine y={1} stroke="#10b981" strokeDasharray="3 3" strokeWidth={1} opacity={0.6} />
          <ReferenceLine y={2} stroke="#3b82f6" strokeDasharray="3 3" strokeWidth={1} opacity={0.6} />

          <Tooltip
            cursor={false}
            content={
              <ChartTooltip
                unit="R"
                hideValues={hideValues}
                formatter={(val) => `${val >= 0 ? '+' : ''}${val.toFixed(2)}R`}
              />
            }
          />

          <Bar
            dataKey="realizedR"
            name="Realized R:R"
            maxBarSize={48}
            radius={[5, 5, 0, 0]}
            isAnimationActive={true}
            animationDuration={800}
            animationEasing="ease-out"
          >
            {chartData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.realizedR >= 0 ? '#10b981' : '#ef4444'}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
