import React, { useMemo } from 'react';
import { Calendar, TrendingUp, TrendingDown, AlertTriangle, ShieldCheck, Zap, Info, Clock } from 'lucide-react';
import { calculateExpiryAnalytics } from '../../services/expiryAnalysisService';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

export default function ExpiryTrackerPage({ trades = [] }) {
  const expiryData = useMemo(() => calculateExpiryAnalytics(trades), [trades]);

  const chartData = useMemo(() => {
    return Object.entries(expiryData.dayStats).map(([day, stat]) => ({
      day,
      name: stat.name,
      pnl: Math.round(stat.pnl),
      trades: stat.count,
      winRate: stat.count > 0 ? Math.round((stat.wins / stat.count) * 100) : 0
    }));
  }, [expiryData]);

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
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Calendar size={24} color="#ef4444" />
          </div>
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary, #111827)', margin: 0 }}>
              Indian F&O Weekly Expiry Tracker
            </h1>
            <p style={{ fontSize: '13px', color: 'var(--text-muted, #6b7280)', margin: '4px 0 0 0' }}>
              Detect and cure gamma crash, theta decay, and overtrading on weekly index expiries
            </p>
          </div>
        </div>

        <div style={{
          backgroundColor: 'rgba(245, 158, 11, 0.1)',
          border: '1px solid rgba(245, 158, 11, 0.3)',
          borderRadius: '12px',
          padding: '10px 16px',
          maxWidth: '420px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <Zap size={18} color="#d97706" style={{ flexShrink: 0 }} />
          <div style={{ fontSize: '12px', color: '#92400e', lineHeight: 1.4 }}>
            <span style={{ fontWeight: 700 }}>AI Expiry Insight: </span>
            {expiryData.primaryInsight}
          </div>
        </div>
      </div>

      {/* KPI Comparison Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '16px'
      }}>
        {/* Card 1: Expiry vs Non-Expiry Win Rate */}
        <div style={{
          backgroundColor: 'var(--bg-card, #ffffff)',
          border: '1px solid var(--border-color, #e5e7eb)',
          borderRadius: '16px',
          padding: '18px',
          boxShadow: 'var(--shadow-card)'
        }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted, #6b7280)', letterSpacing: '0.5px' }}>
            EXPIRY WIN RATE
          </div>
          <div style={{ fontSize: '24px', fontWeight: 900, color: expiryData.expiryWinRate >= 50 ? '#059669' : '#dc2626', marginTop: '6px' }}>
            {expiryData.expiryWinRate}%
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted, #6b7280)', marginTop: '4px' }}>
            vs <span style={{ fontWeight: 700 }}>{expiryData.nonExpiryWinRate}%</span> on normal days
          </div>
        </div>

        {/* Card 2: Expiry Net P&L */}
        <div style={{
          backgroundColor: 'var(--bg-card, #ffffff)',
          border: '1px solid var(--border-color, #e5e7eb)',
          borderRadius: '16px',
          padding: '18px',
          boxShadow: 'var(--shadow-card)'
        }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted, #6b7280)', letterSpacing: '0.5px' }}>
            EXPIRY REALIZED P&L
          </div>
          <div style={{ fontSize: '24px', fontWeight: 900, color: expiryData.expiryTotalPnL >= 0 ? '#059669' : '#dc2626', marginTop: '6px' }}>
            {expiryData.expiryTotalPnL >= 0 ? `+₹${expiryData.expiryTotalPnL.toLocaleString('en-IN')}` : `-₹${Math.abs(expiryData.expiryTotalPnL).toLocaleString('en-IN')}`}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted, #6b7280)', marginTop: '4px' }}>
            Across {expiryData.expiryTradesCount} expiry trades
          </div>
        </div>

        {/* Card 3: Non-Expiry Normal Days P&L */}
        <div style={{
          backgroundColor: 'var(--bg-card, #ffffff)',
          border: '1px solid var(--border-color, #e5e7eb)',
          borderRadius: '16px',
          padding: '18px',
          boxShadow: 'var(--shadow-card)'
        }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted, #6b7280)', letterSpacing: '0.5px' }}>
            NON-EXPIRY P&L
          </div>
          <div style={{ fontSize: '24px', fontWeight: 900, color: expiryData.nonExpiryTotalPnL >= 0 ? '#059669' : '#dc2626', marginTop: '6px' }}>
            {expiryData.nonExpiryTotalPnL >= 0 ? `+₹${expiryData.nonExpiryTotalPnL.toLocaleString('en-IN')}` : `-₹${Math.abs(expiryData.nonExpiryTotalPnL).toLocaleString('en-IN')}`}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted, #6b7280)', marginTop: '4px' }}>
            Across {expiryData.nonExpiryTradesCount} normal trades
          </div>
        </div>

        {/* Card 4: Post 2:30 PM Expiry Bleed */}
        <div style={{
          backgroundColor: 'var(--bg-card, #ffffff)',
          border: '1px solid var(--border-color, #e5e7eb)',
          borderRadius: '16px',
          padding: '18px',
          boxShadow: 'var(--shadow-card)'
        }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted, #6b7280)', letterSpacing: '0.5px' }}>
            POST 2:30 PM EXPIRY P&L
          </div>
          <div style={{ fontSize: '24px', fontWeight: 900, color: expiryData.lateExpiryPnL >= 0 ? '#059669' : '#dc2626', marginTop: '6px' }}>
            {expiryData.lateExpiryPnL >= 0 ? `+₹${expiryData.lateExpiryPnL.toLocaleString('en-IN')}` : `-₹${Math.abs(expiryData.lateExpiryPnL).toLocaleString('en-IN')}`}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted, #6b7280)', marginTop: '4px' }}>
            {expiryData.lateExpiryTradesCount} trades in final 60 mins
          </div>
        </div>
      </div>

      {/* Expiry Breakdown Chart & Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '2fr 1fr',
        gap: '20px'
      }}>
        {/* Chart */}
        <div style={{
          backgroundColor: 'var(--bg-card, #ffffff)',
          border: '1px solid var(--border-color, #e5e7eb)',
          borderRadius: '16px',
          padding: '20px',
          boxShadow: 'var(--shadow-card)'
        }}>
          <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary, #111827)', marginBottom: '16px' }}>
            P&L Breakdown by Weekly Expiry Day
          </h3>
          <div style={{ height: '260px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color, #e5e7eb)" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 12, fill: 'var(--text-muted, #6b7280)' }} />
                <YAxis tick={{ fontSize: 12, fill: 'var(--text-muted, #6b7280)' }} />
                <Tooltip
                  formatter={(value) => [`₹${value.toLocaleString('en-IN')}`, 'P&L']}
                  contentStyle={{ backgroundColor: '#1f2937', color: '#ffffff', borderRadius: '8px', border: 'none' }}
                />
                <Bar dataKey="pnl" fill="var(--text-primary, #111827)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Expiry Calendar Rules */}
        <div style={{
          backgroundColor: 'var(--bg-card, #ffffff)',
          border: '1px solid var(--border-color, #e5e7eb)',
          borderRadius: '16px',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          boxShadow: 'var(--shadow-card)'
        }}>
          <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary, #111827)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Calendar size={16} className="text-foreground inline" />
            <span>Indian Weekly Expiry Cycle</span>
          </h3>
          {Object.entries(expiryData.dayStats).map(([day, stat]) => (
            <div
              key={day}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 12px',
                borderRadius: '10px',
                backgroundColor: 'var(--bg-primary, #f9fafb)',
                border: '1px solid var(--border-color, #e5e7eb)'
              }}>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary, #111827)' }}>
                  {day} — {stat.name}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted, #6b7280)' }}>
                  {stat.count} trades | {stat.count > 0 ? Math.round((stat.wins / stat.count) * 100) : 0}% Win Rate
                </div>
              </div>
              <div style={{
                fontSize: '13px',
                fontWeight: 800,
                color: stat.pnl >= 0 ? '#059669' : '#dc2626'
              }}>
                {stat.pnl >= 0 ? `+₹${Math.round(stat.pnl).toLocaleString('en-IN')}` : `-₹${Math.round(Math.abs(stat.pnl)).toLocaleString('en-IN')}`}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
