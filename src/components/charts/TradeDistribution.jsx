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

const DEFAULT_MOCK_DISTRIBUTION = [
  { xLabel: '#1 RELIANCE', ticker: 'RELIANCE', seq: 1, date: '02/01', netPnl: -2790 },
  { xLabel: '#2 TCS', ticker: 'TCS', seq: 2, date: '09/01', netPnl: 10500 },
  { xLabel: '#3 HDFCBANK', ticker: 'HDFCBANK', seq: 3, date: '16/01', netPnl: 5700 },
  { xLabel: '#4 TATAMOTORS', ticker: 'TATAMOTORS', seq: 4, date: '22/01', netPnl: 0 },
  { xLabel: '#5 INFY', ticker: 'INFY', seq: 5, date: '01/02', netPnl: 6420 },
  { xLabel: '#6 ICICIBANK', ticker: 'ICICIBANK', seq: 6, date: '08/02', netPnl: -2000 },
  { xLabel: '#7 BHARTIARTL', ticker: 'BHARTIARTL', seq: 7, date: '18/02', netPnl: 10500 },
  { xLabel: '#8 SBIN', ticker: 'SBIN', seq: 8, date: '28/02', netPnl: 5000 }
];

const renderCustomXAxisTick = ({ x, y, payload }) => {
  const str = String(payload?.value || '');
  const match = str.match(/^(#\d+)\s*(.*)$/);
  if (match) {
    const num = match[1];
    const ticker = match[2].length > 7 ? match[2].slice(0, 6) + '…' : match[2];
    return (
      <g transform={`translate(${x},${y})`}>
        <text x={0} y={11} textAnchor="middle" fill="#64748b" fontSize={10} fontWeight={600}>
          {num}
        </text>
        {ticker && (
          <text x={0} y={22} textAnchor="middle" fill="#94a3b8" fontSize={9} fontWeight={500}>
            {ticker}
          </text>
        )}
      </g>
    );
  }
  return (
    <text x={x} y={y + 12} textAnchor="middle" fill="#94a3b8" fontSize={10}>
      {str}
    </text>
  );
};

export default function TradeDistribution({
  data,
  trades,
  height = 340,
  hideValues = false,
  winColor = '#10b981',
  lossColor = '#ef4444',
  customTooltip
}) {
  const chartData = useMemo(() => {
    if (data && data.length > 0) return data;
    if (!trades || trades.length === 0) return DEFAULT_MOCK_DISTRIBUTION;

    return trades
      .filter((t) => t.status === 'Closed')
      .map((t, idx) => {
        const net = Number(t.netPnl ?? (Number(t.grossPnl ?? t.pl ?? t.pnl ?? 0) - Number(t.charges?.total ?? 0)));
        return {
          id: t.id || idx,
          seq: idx + 1,
          ticker: t.name || t.symbol || 'Trade',
          xLabel: `#${idx + 1} ${t.name || t.symbol || ''}`,
          date: t.e1Date || t.exitDate || t.date || `T#${idx + 1}`,
          netPnl: net
        };
      });
  }, [data, trades]);

  const count = chartData.length;

  const formatYAxis = (val) => {
    if (hideValues) return '••••';
    const abs = Math.abs(val);
    if (abs >= 10000000) return `₹${(val / 10000000).toFixed(1)}Cr`;
    if (abs >= 100000) return `₹${(val / 100000).toFixed(1)}L`;
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
          margin={{ top: 16, right: 20, left: 6, bottom: 24 }}
          barCategoryGap={count > 50 ? '8%' : '20%'}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color, #f1f5f9)" vertical={false} />

          <XAxis
            dataKey="xLabel"
            interval={count <= 15 ? 0 : 'preserveStartEnd'}
            minTickGap={count > 50 ? 36 : 16}
            tickLine={false}
            axisLine={{ stroke: 'var(--border-color, #e5e7eb)' }}
            padding={{ left: 16, right: 16 }}
            tick={renderCustomXAxisTick}
          />

          <YAxis
            width={60}
            stroke="var(--text-muted, #9ca3af)"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            tickFormatter={formatYAxis}
          />

          <ReferenceLine y={0} stroke="var(--text-muted, #cbd5e1)" strokeWidth={1.2} />

          <Tooltip
            cursor={{ fill: 'rgba(0, 0, 0, 0.03)' }}
            content={customTooltip || <ChartTooltip unit="₹" hideValues={hideValues} />}
          />

          <Bar
            dataKey="netPnl"
            name="Net P&L"
            maxBarSize={count > 120 ? 5 : count > 60 ? 9 : count > 25 ? 16 : 28}
            isAnimationActive={count <= 150}
            animationDuration={600}
            animationEasing="ease-out"
          >
            {chartData.map((entry, index) => {
              const isWin = (entry.netPnl ?? 0) >= 0;
              return (
                <Cell
                  key={`cell-${entry.id || index}`}
                  fill={isWin ? winColor : lossColor}
                  radius={isWin ? [3, 3, 0, 0] : [0, 0, 3, 3]}
                />
              );
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
