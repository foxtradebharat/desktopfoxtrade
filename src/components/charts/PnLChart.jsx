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

const DEFAULT_MOCK_PNL = [
  { xLabel: '#1 RELIANCE', date: '02/01', cumGross: -2790, cumNet: -2790, grossPnl: -2790, netPnl: -2790 },
  { xLabel: '#2 TCS', date: '09/01', cumGross: 7710, cumNet: 7710, grossPnl: 10500, netPnl: 10500 },
  { xLabel: '#3 HDFCBANK', date: '16/01', cumGross: 13410, cumNet: 13410, grossPnl: 5700, netPnl: 5700 },
  { xLabel: '#4 TATAMOTORS', date: '22/01', cumGross: 13410, cumNet: 13410, grossPnl: 0, netPnl: 0 },
  { xLabel: '#5 INFY', date: '01/02', cumGross: 19830, cumNet: 19830, grossPnl: 6420, netPnl: 6420 },
  { xLabel: '#6 ICICIBANK', date: '08/02', cumGross: 17830, cumNet: 17830, grossPnl: -2000, netPnl: -2000 },
  { xLabel: '#7 BHARTIARTL', date: '18/02', cumGross: 28330, cumNet: 28330, grossPnl: 10500, netPnl: 10500 },
  { xLabel: '#8 SBIN', date: '28/02', cumGross: 33330, cumNet: 33330, grossPnl: 5000, netPnl: 5000 }
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

export default function PnLChart({
  data = DEFAULT_MOCK_PNL,
  linesMode = 'both', // 'both' | 'net' | 'gross'
  height = 340,
  hideValues = false,
  showZeroLine = true,
  isEmbedded = true,
  customTooltip
}) {
  const chartData = data && data.length > 0 ? data : DEFAULT_MOCK_PNL;
  const count = chartData.length;
  const isDense = count > 25;
  const lastPoint = chartData[count - 1] || {};
  const isNetTotalProfit = (lastPoint.cumNet ?? 0) >= 0;

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
        <LineChart
          data={chartData}
          margin={{ top: 16, right: 20, left: 6, bottom: 24 }}
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

          {showZeroLine && (
            <ReferenceLine y={0} stroke="var(--text-muted, #cbd5e1)" strokeWidth={1.2} />
          )}

          <Tooltip
            cursor={{ stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '3 3' }}
            content={customTooltip || <ChartTooltip unit="₹" hideValues={hideValues} />}
          />

          {/* Gross P&L Line (Before Charges) */}
          {(linesMode === 'both' || linesMode === 'gross') && (
            <Line
              type="monotone"
              dataKey="cumGross"
              name="Gross P&L"
              stroke="#3b82f6"
              strokeWidth={count > 150 ? 2 : 2.8}
              strokeLinecap="round"
              strokeLinejoin="round"
              dot={isDense ? false : { r: 4, stroke: '#3b82f6', strokeWidth: 2, fill: '#ffffff' }}
              activeDot={{ r: 6, stroke: '#3b82f6', strokeWidth: 2.5, fill: '#ffffff' }}
              isAnimationActive={count <= 150}
              animationDuration={1000}
              animationEasing="ease-in-out"
            />
          )}

          {/* Net P&L Line (After Charges) */}
          {(linesMode === 'both' || linesMode === 'net') && (
            <Line
              type="monotone"
              dataKey="cumNet"
              name="Net P&L"
              stroke={isNetTotalProfit ? '#10b981' : '#ef4444'}
              strokeWidth={count > 150 ? 2 : 2.8}
              strokeLinecap="round"
              strokeLinejoin="round"
              dot={isDense ? false : {
                r: 4,
                stroke: isNetTotalProfit ? '#10b981' : '#ef4444',
                strokeWidth: 2,
                fill: '#ffffff'
              }}
              activeDot={{
                r: 6,
                stroke: isNetTotalProfit ? '#10b981' : '#ef4444',
                strokeWidth: 2.5,
                fill: '#ffffff'
              }}
              isAnimationActive={count <= 150}
              animationDuration={1200}
              animationEasing="ease-in-out"
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
