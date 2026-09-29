import React from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine
} from 'recharts';
import ChartTooltip from './ChartTooltip';

// Fallback mock data when no external data provided
const DEFAULT_MOCK_EQUITY = [
  { date: '01 Jan', equity: 200000, benchmark: 200000 },
  { date: '15 Jan', equity: 208500, benchmark: 202100 },
  { date: '01 Feb', equity: 205200, benchmark: 201800 },
  { date: '15 Feb', equity: 219400, benchmark: 204300 },
  { date: '01 Mar', equity: 226800, benchmark: 207100 },
  { date: '15 Mar', equity: 222100, benchmark: 205900 },
  { date: '01 Apr', equity: 238500, benchmark: 209400 }
];

export default function EquityCurve({
  data = DEFAULT_MOCK_EQUITY,
  height = 320,
  hideValues = false,
  showBenchmark = true,
  benchmarkName = 'NIFTY 50',
  equityColor = '#10b981',
  benchmarkColor = '#94a3b8',
  startCapital,
  isEmbedded = true
}) {
  const chartData = data && data.length > 0 ? data : DEFAULT_MOCK_EQUITY;

  // Format currency for Y-axis
  const formatYAxis = (val) => {
    if (hideValues) return '••••';
    const abs = Math.abs(val);
    if (abs >= 10000000) return `₹${(val / 10000000).toFixed(1)}Cr`;
    if (abs >= 100000) return `₹${(val / 100000).toFixed(1)}L`;
    if (abs >= 1000) return `₹${(val / 1000).toFixed(0)}k`;
    return `₹${val}`;
  };

  // Handle single data point padding
  const isSinglePoint = chartData.length === 1;
  const processedData = isSinglePoint
    ? [
        { ...chartData[0], date: 'Start' },
        chartData[0]
      ]
    : chartData;

  const baseline = startCapital || (chartData.length > 0 ? chartData[0].equity : 0);

  return (
    <div
      style={{
        width: '100%',
        height: typeof height === 'number' ? `${height}px` : height,
        position: 'relative'
      }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={processedData}
          margin={{ top: 12, right: 20, left: 10, bottom: 6 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color, #f1f5f9)" vertical={false} />

          <XAxis
            dataKey="date"
            stroke="var(--text-muted, #9ca3af)"
            fontSize={11}
            tickLine={false}
            axisLine={{ stroke: 'var(--border-color, #e5e7eb)' }}
          />

          <YAxis
            width={58}
            stroke="var(--text-muted, #9ca3af)"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            tickFormatter={formatYAxis}
            domain={['auto', 'auto']}
          />

          {baseline > 0 && (
            <ReferenceLine
              y={baseline}
              stroke="var(--text-muted, #cbd5e1)"
              strokeWidth={1}
              strokeDasharray="3 3"
            />
          )}

          <Tooltip
            cursor={{ stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '3 3' }}
            content={<ChartTooltip unit="₹" hideValues={hideValues} />}
          />

          {/* Benchmark Line */}
          {showBenchmark && (
            <Line
              type="monotone"
              dataKey="benchmark"
              name={benchmarkName}
              stroke={benchmarkColor}
              strokeWidth={1.8}
              strokeDasharray="4 4"
              dot={false}
              activeDot={{ r: 4.5, stroke: benchmarkColor, strokeWidth: 2, fill: '#ffffff' }}
              isAnimationActive={true}
              animationDuration={800}
              animationEasing="ease-out"
            />
          )}

          {/* Portfolio Equity Line */}
          <Line
            type="monotone"
            dataKey="equity"
            name="Portfolio Equity"
            stroke={equityColor}
            strokeWidth={2.8}
            strokeLinecap="round"
            strokeLinejoin="round"
            dot={{ r: 3.5, stroke: equityColor, strokeWidth: 2, fill: '#ffffff' }}
            activeDot={{ r: 6.5, stroke: equityColor, strokeWidth: 2.8, fill: '#ffffff' }}
            isAnimationActive={true}
            animationDuration={1100}
            animationEasing="ease-in-out"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
