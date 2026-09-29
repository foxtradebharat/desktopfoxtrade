import React, { useState, useMemo } from 'react';
import {
  CheckCircle2,
  AlertCircle,
  Clock,
  Trash2,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Plus
} from 'lucide-react';
import SymbolLogo from '../SymbolLogo';
import { getTradePnL, getTradeRMultiple, getPlaybookTrades, parseTradeDateMs } from '../../services/playbookService';

export default function PlaybookExecutedTradesTab({
  playbook,
  allTrades = [],
  tradeAudits = {},
  settings = null,
  onOpenAuditModal,
  onUnlinkTrade
}) {
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Filter trades that belong to this playbook using unified single-source filter
  const pbTrades = useMemo(() => {
    const trades = getPlaybookTrades(playbook, allTrades, tradeAudits, settings);
    // Sort newest trades first for executed table inspection
    return [...trades].sort((a, b) => parseTradeDateMs(b) - parseTradeDateMs(a));
  }, [allTrades, tradeAudits, playbook, settings]);

  const totalTrades = pbTrades.length;
  const totalPages = Math.max(1, Math.ceil(totalTrades / pageSize));
  const paginatedTrades = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return pbTrades.slice(start, start + pageSize);
  }, [pbTrades, currentPage]);

  const formatCurrency = (val) => {
    const num = Number(val) || 0;
    const sign = num < 0 ? '-' : num > 0 ? '+' : '';
    return `${sign}₹${Math.abs(num).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
  };

  const formatPrice = (val) => {
    const num = Number(val) || 0;
    return num > 0 ? `₹${num.toFixed(2)}` : '—';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Top action row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
            {playbook.isNoSetup ? 'Impulse Executions' : 'Trades Executed'} ({totalTrades})
          </span>
          <p style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>
            {playbook.isNoSetup
              ? 'Trades taken without a documented setup or checklist criteria. Audit to categorize or track discipline breakdown.'
              : 'Real journal trades tagged to this setup. Click any trade to audit rule compliance.'}
          </p>
        </div>

        <button
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
          <Plus size={13} />
          <span>{playbook.isNoSetup ? 'Tag Trade as Impulse' : 'Tag Trade to Playbook'}</span>
        </button>
      </div>

      {/* Trades Table matching Image 3 */}
      <div style={{
        background: 'var(--bg-surface)',
        border: '1px solid color-mix(in srgb, var(--border-color) 25%, transparent)',
        borderRadius: 12,
        overflow: 'hidden'
      }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{
                borderBottom: '1px solid color-mix(in srgb, var(--border-color) 20%, transparent)',
                background: 'var(--bg-primary)',
                fontSize: 11,
                fontWeight: 600,
                color: 'var(--text-muted)',
                letterSpacing: '0.02em'
              }}>
                <th style={{ padding: '12px 16px' }}>Open Date</th>
                <th style={{ padding: '12px 14px' }}>Symbol</th>
                <th style={{ padding: '12px 14px' }}>Status</th>
                <th style={{ padding: '12px 14px' }}>Close Date</th>
                <th style={{ padding: '12px 14px', textAlign: 'right' }}>Entry Price</th>
                <th style={{ padding: '12px 14px', textAlign: 'right' }}>Exit Price</th>
                <th style={{ padding: '12px 14px', textAlign: 'right' }}>Net P&amp;L</th>
                <th style={{ padding: '12px 14px', textAlign: 'right' }}>Net ROI / R</th>
                <th style={{ padding: '12px 14px' }}>Setup</th>
                <th style={{ padding: '12px 14px' }}>Account</th>
                <th style={{ padding: '12px 14px', textAlign: 'center' }}>Discipline</th>
                <th style={{ padding: '12px 14px', textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedTrades.length === 0 ? (
                <tr>
                  <td colSpan={12} style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                    No executed trades found for this playbook yet. Use the button above to link journal trades.
                  </td>
                </tr>
              ) : (
                paginatedTrades.map(trade => {
                  const pnl = getTradePnL(trade);
                  const isWin = pnl > 0;
                  const isLoss = pnl < 0;
                  const isBE = pnl === 0;

                  const rMultiple = getTradeRMultiple(trade);
                  const audit = tradeAudits[trade.id];
                  const disciplineScore = audit?.disciplineScore !== undefined ? audit.disciplineScore : 100;
                  const isDisciplined = disciplineScore >= 100;

                  const openDate = trade.date || trade.entryDate || '—';
                  const closeDate = trade.exitDate || trade.date || '—';
                  const entryPrice = trade.avgEntry || trade.entry || 0;
                  const exitPrice = trade.avgExitPrice || trade.exitPrice || 0;

                  // ROI calculation
                  const roi = entryPrice > 0 ? ((exitPrice - entryPrice) / entryPrice * 100) : 0;

                  return (
                    <tr
                      key={trade.id}
                      style={{
                        borderBottom: '1px solid color-mix(in srgb, var(--border-color) 18%, transparent)',
                        fontSize: 12.5,
                        transition: 'background 0.1s ease'
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-primary)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      {/* Open Date */}
                      <td style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                        {openDate}
                      </td>

                      {/* Symbol */}
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                          <SymbolLogo symbol={trade.name || trade.symbol} size={18} />
                          <span style={{ fontWeight: 550, color: 'var(--text-primary)' }}>
                            {trade.name || trade.symbol || 'NIFTY'}
                          </span>
                        </div>
                      </td>

                      {/* Status Pill (matching Image 3) */}
                      <td style={{ padding: '12px 14px' }}>
                        {isWin && (
                          <span style={{
                            display: 'inline-block',
                            padding: '2px 7px',
                            borderRadius: 4,
                            border: '1px solid #10b981',
                            color: '#10b981',
                            fontSize: 10.5,
                            fontWeight: 600,
                            letterSpacing: '0.02em'
                          }}>
                            WIN
                          </span>
                        )}
                        {isLoss && (
                          <span style={{
                            display: 'inline-block',
                            padding: '2px 7px',
                            borderRadius: 4,
                            border: '1px solid #ef4444',
                            color: '#ef4444',
                            fontSize: 10.5,
                            fontWeight: 600,
                            letterSpacing: '0.02em'
                          }}>
                            LOSS
                          </span>
                        )}
                        {isBE && (
                          <span style={{
                            display: 'inline-block',
                            padding: '2px 7px',
                            borderRadius: 4,
                            border: '1px solid color-mix(in srgb, var(--border-color) 40%, transparent)',
                            color: 'var(--text-muted)',
                            fontSize: 10.5,
                            fontWeight: 600,
                            letterSpacing: '0.02em'
                          }}>
                            BE
                          </span>
                        )}
                      </td>

                      {/* Close Date */}
                      <td style={{ padding: '12px 14px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                        {closeDate}
                      </td>

                      {/* Entry Price */}
                      <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 500 }}>
                        {formatPrice(entryPrice)}
                      </td>

                      {/* Exit Price */}
                      <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 500 }}>
                        {formatPrice(exitPrice)}
                      </td>

                      {/* Net P&L */}
                      <td style={{
                        padding: '12px 14px',
                        textAlign: 'right',
                        fontFamily: 'var(--font-mono)',
                        fontWeight: 550,
                        color: isWin ? '#10b981' : isLoss ? '#ef4444' : 'var(--text-muted)'
                      }}>
                        {formatCurrency(pnl)}
                      </td>

                      {/* Net ROI / R Multiple */}
                      <td style={{
                        padding: '12px 14px',
                        textAlign: 'right',
                        fontFamily: 'var(--font-mono)',
                        fontWeight: 500,
                        color: isWin ? '#10b981' : isLoss ? '#ef4444' : 'var(--text-muted)'
                      }}>
                        {rMultiple !== 0 ? `${rMultiple > 0 ? '+' : ''}${rMultiple.toFixed(2)}R` : `${roi > 0 ? '+' : ''}${roi.toFixed(1)}%`}
                      </td>

                      {/* Setups Pill */}
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{
                          display: 'inline-block',
                          padding: '2px 8px',
                          borderRadius: 6,
                          background: 'color-mix(in srgb, var(--text-primary) 5%, transparent)',
                          border: '1px solid color-mix(in srgb, var(--border-color) 25%, transparent)',
                          color: 'var(--text-secondary)',
                          fontSize: 11,
                          fontWeight: 500
                        }}>
                          {trade.setup || playbook.title}
                        </span>
                      </td>

                      {/* Account / Broker */}
                      <td style={{ padding: '12px 14px', color: 'var(--text-muted)', fontSize: 11.5, fontWeight: 450 }}>
                        {trade.broker || 'FoxTrade Primary'}
                      </td>

                      {/* Discipline Score % */}
                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                        <span style={{
                          padding: '2px 7px',
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: 600,
                          fontFamily: 'var(--font-mono)',
                          background: isDisciplined ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                          color: isDisciplined ? '#059669' : '#dc2626'
                        }}>
                          {disciplineScore}%
                        </span>
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                          <button
                            onClick={() => onOpenAuditModal(trade, playbook.id)}
                            title="Audit Checklist & Discipline"
                            style={{
                              padding: '4px 8px',
                              borderRadius: 6,
                              border: '1px solid color-mix(in srgb, var(--border-color) 25%, transparent)',
                              background: 'var(--bg-surface)',
                              color: 'var(--text-primary)',
                              fontSize: 11,
                              fontWeight: 500,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4
                            }}
                          >
                            <CheckSquare size={12} />
                            <span>Audit</span>
                          </button>

                          {onUnlinkTrade && (
                            <button
                              onClick={() => onUnlinkTrade(trade.id)}
                              title="Unlink from Playbook"
                              style={{
                                background: 'none',
                                border: 'none',
                                color: 'var(--text-muted)',
                                cursor: 'pointer',
                                padding: 4,
                                display: 'flex',
                                opacity: 0.5
                              }}
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination footer matching Image 3 */}
        {totalTrades > 0 && (
          <div style={{
            padding: '12px 18px',
            borderTop: '1px solid color-mix(in srgb, var(--border-color) 20%, transparent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            fontSize: 12,
            color: 'var(--text-muted)'
          }}>
            <span>Result: {((currentPage - 1) * pageSize) + 1} - {Math.min(currentPage * pageSize, totalTrades)} of {totalTrades} trades</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                style={{
                  background: 'none',
                  border: '1px solid color-mix(in srgb, var(--border-color) 25%, transparent)',
                  borderRadius: 6,
                  padding: 4,
                  cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                  opacity: currentPage === 1 ? 0.4 : 1,
                  display: 'flex',
                  color: 'var(--text-primary)'
                }}
              >
                <ChevronLeft size={14} />
              </button>
              <span style={{
                padding: '2px 8px',
                borderRadius: 6,
                background: 'color-mix(in srgb, var(--text-primary) 9%, var(--bg-surface))',
                color: 'var(--text-primary)',
                border: '1px solid color-mix(in srgb, var(--border-color) 35%, transparent)',
                fontWeight: 600,
                fontSize: 11
              }}>
                {currentPage}
              </span>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                style={{
                  background: 'none',
                  border: '1px solid color-mix(in srgb, var(--border-color) 25%, transparent)',
                  borderRadius: 6,
                  padding: 4,
                  cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                  opacity: currentPage === totalPages ? 0.4 : 1,
                  display: 'flex',
                  color: 'var(--text-primary)'
                }}
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
