import React, { useState, useMemo } from 'react';
import { ShieldAlert, AlertTriangle, CheckCircle2, ChevronRight, Activity } from 'lucide-react';
import { calculateTiltmeterScore } from '../services/tiltmeterService';

export default function TiltmeterWidget({ trades = [] }) {
  const [isOpen, setIsOpen] = useState(false);
  const tiltData = useMemo(() => calculateTiltmeterScore(trades), [trades]);

  return (
    <div style={{ position: 'relative' }}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        title="Psychology & Tiltmeter Guard"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '5px 10px',
          borderRadius: '9999px',
          backgroundColor: tiltData.bg,
          border: `1px solid ${tiltData.color}40`,
          cursor: 'pointer',
          transition: 'all 0.2s ease'
        }}>
        <div style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          backgroundColor: tiltData.color,
          boxShadow: `0 0 8px ${tiltData.color}`
        }} />
        <span style={{
          fontSize: '11px',
          fontWeight: 700,
          color: tiltData.color,
          letterSpacing: '0.4px'
        }}>
          {tiltData.status}
        </span>
      </button>

      {/* Detail Popover */}
      {isOpen && (
        <>
          <div
            onClick={() => setIsOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 999
            }}
          />
          <div style={{
            position: 'absolute',
            top: '38px',
            right: '0',
            width: '320px',
            backgroundColor: 'var(--bg-card, #ffffff)',
            border: '1px solid var(--border-color, #e5e7eb)',
            borderRadius: '16px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            padding: '16px',
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Activity size={16} color={tiltData.color} />
                <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-primary, #111827)' }}>
                  Psychological Tiltmeter
                </span>
              </div>
              <span style={{
                fontSize: '11px',
                fontWeight: 700,
                color: tiltData.color,
                backgroundColor: tiltData.bg,
                padding: '2px 8px',
                borderRadius: '6px'
              }}>
                Risk: {tiltData.score}/100
              </span>
            </div>

            {/* Verdict */}
            <div style={{
              fontSize: '12px',
              color: 'var(--text-primary, #374151)',
              lineHeight: 1.4,
              backgroundColor: 'var(--bg-primary, #f9fafb)',
              padding: '10px 12px',
              borderRadius: '8px',
              border: '1px solid var(--border-color, #e5e7eb)'
            }}>
              {tiltData.verdict}
            </div>

            {/* Triggers list */}
            {tiltData.triggers.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted, #6b7280)' }}>
                  Active Psychological Signals:
                </span>
                {tiltData.triggers.map((t, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '8px',
                      fontSize: '11px',
                      color: 'var(--text-primary, #374151)'
                    }}>
                    <AlertTriangle size={13} color={t.level === 'HIGH' ? '#ef4444' : '#f59e0b'} style={{ flexShrink: 0, marginTop: '2px' }} />
                    <div>
                      <div style={{ fontWeight: 700 }}>{t.title}</div>
                      <div style={{ color: 'var(--text-muted, #6b7280)', fontSize: '10px' }}>{t.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#059669' }}>
                <CheckCircle2 size={14} color="#059669" />
                <span>Zero revenge trading or sizing leaks detected.</span>
              </div>
            )}

            {/* Actionable Rule */}
            <div style={{
              borderTop: '1px solid var(--border-color, #e5e7eb)',
              paddingTop: '8px',
              fontSize: '11px',
              color: 'var(--text-primary, #111827)'
            }}>
              <span style={{ fontWeight: 800 }}>⚡ Guardrail Action: </span>
              <span>{tiltData.action}</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
