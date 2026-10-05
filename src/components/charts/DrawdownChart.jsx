import React, { useMemo } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine
} from 'recharts';
import ChartTooltip from './ChartTooltip';

const DEFAULT_MOCK_DRAWDOWN = [
  { date: 'Trade 1', drawdownPct: 0.0, amount: 0 },
  { date: 'Trade 2', drawdownPct: -1.35, amount: -2790 },
  { date: 'Trade 3', drawdownPct: 0.0, amount: 0 },
  { date: 'Trade 4', drawdownPct: -0.42, amount: -890 },
  { date: 'Trade 5', drawdownPct: -2.15, amount: -4500 },
  { date: 'Trade 6', drawdownPct: -0.80, amount: -1700 },
  { date: 'Trade 7', drawdownPct: 0.0, amount: 0 },
  { date: 'Trade 8', drawdownPct: 0.0, amount: 0 }
];

export default function DrawdownChart({
  data,
  trades,
  height = 260,
  hideValues = false,
  maxDrawdown,
  strokeColor = '#ef4444',
  fillColor = '#ef4444',
  livePoint = null
}) {
  // Calculate drawdown series from trades if raw trades provided
  const chartData = useMemo(() => {
    let base = [];
    if (data && data.length > 0) {
      base = data;
    } else if (!trades || trades.length === 0) {
      base = DEFAULT_MOCK_DRAWDOWN;
    } else {
      let peak = 0;
      let runningNet = 0;

      base = trades
        .filter((t) => t.status === 'Closed')
        .map((t, idx) => {
          const net = Number(t.netPnl ?? t.pl ?? t.pnl ?? 0);
          runningNet += net;
          if (runningNet > peak) peak = runningNet;
          const fallbackCap = 100000;
          const ddAmount = runningNet - peak;
          const ddPct = peak > 0 ? (ddAmount / peak) * 100 : (runningNet < 0 ? (runningNet / fallbackCap) * 100 : 0);

          return {
            date: t.e1Date || t.exitDate || t.date || `T#${idx + 1}`,
            tradeNo: idx + 1,
            symbol: t.name || t.symbol || '',
            drawdownPct: Math.min(0, Math.round(ddPct * 100) / 100),
            amount: ddAmount,
            equity: runningNet,
            peak
          };
        });
    }

    if (!livePoint || (livePoint.drawdownPct === undefined && livePoint.livePct === undefined)) {
      return base;
    }

    const liveVal = Number(livePoint.drawdownPct ?? livePoint.livePct ?? 0);
    const lastItem = base[base.length - 1] || {};
    const lastDd = lastItem.drawdownPct ?? 0;

    // Build series appending temporary 'Now (live)' point — not stored
    const result = base.map((d, i) => {
      if (i === base.length - 1) {
        return { ...d, liveSegmentPct: d.drawdownPct };
      }
      return { ...d, liveSegmentPct: undefined };
    });

    result.push({
      date: 'Now (live)',
      tradeNo: 'Live',
      symbol: 'Live Portfolio',
      drawdownPct: null,
      liveSegmentPct: Math.min(0, Math.round(liveVal * 100) / 100),
      amount: livePoint.amount ?? 0,
      equity: livePoint.liveEquity,
      isLive: true
    });

    return result;
  }, [data, trades, livePoint]);

  // Find maximum drawdown value
  const computedMaxDD = useMemo(() => {
    if (typeof maxDrawdown === 'number') return maxDrawdown;
    let minVal = 0;
    chartData.forEach((d) => {
      if (d.drawdownPct < minVal) minVal = d.drawdownPct;
    });
    return minVal;
  }, [chartData, maxDrawdown]);

  return (
    <div
      style={{
        width: '100%',
        height: typeof height === 'number' ? `${height}px` : height,
        position: 'relative'
      }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={chartData}
          margin={{ top: 10, right: 20, left: 10, bottom: 6 }}
        >
          <defs>
            <linearGradient id="drawdownGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={fillColor} stopOpacity={0.25} />
              <stop offset="95%" stopColor={fillColor} stopOpacity={0.02} />
            </linearGradient>
          </defs>

          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color, #f1f5f9)" vertical={false} />

          <XAxis
            dataKey="date"
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
            domain={[dataMin => Math.min(dataMin * 1.2, -1), 0]}
            tickFormatter={(val) => (hideValues ? '•••' : `${val}%`)}
          />

          <ReferenceLine y={0} stroke="var(--text-muted, #cbd5e1)" strokeWidth={1.2} />

          {computedMaxDD < 0 && (
            <ReferenceLine
              y={computedMaxDD}
              stroke="#dc2626"
              strokeDasharray="4 4"
              strokeWidth={1.2}
              label={{
                value: hideValues ? 'Max DD' : `Max DD: ${computedMaxDD.toFixed(1)}%`,
                position: 'insideBottomRight',
                fill: '#dc2626',
                fontSize: 10,
                fontWeight: 700
              }}
            />
          )}

          <Tooltip
            cursor={{ stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '3 3' }}
            content={
              <ChartTooltip
                unit="%"
                hideValues={hideValues}
                formatter={(val, name) => {
                  if (name === 'drawdownPct' || name === 'liveSegmentPct') return `${val.toFixed(2)}%`;
                  return val;
                }}
              />
            }
          />

          <Area
            type="stepAfter"
            dataKey="drawdownPct"
            name="Drawdown"
            stroke={strokeColor}
            strokeWidth={2.4}
            fill="url(#drawdownGradient)"
            activeDot={{ r: 5.5, stroke: strokeColor, strokeWidth: 2, fill: '#ffffff' }}
            isAnimationActive={true}
            animationDuration={900}
            animationEasing="ease-out"
          />

          {livePoint && (
            <Line
              type="linear"
              dataKey="liveSegmentPct"
              name="Live DD"
              stroke="#3b82f6"
              strokeDasharray="4 4"
              strokeWidth={2}
              dot={{ r: 4.5, fill: '#3b82f6', stroke: '#ffffff', strokeWidth: 2 }}
              activeDot={{ r: 6, fill: '#3b82f6', stroke: '#ffffff', strokeWidth: 2 }}
              isAnimationActive={false}
            />
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
