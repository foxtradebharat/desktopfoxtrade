import React, { useState } from 'react';
import { BarChart3, Sparkles } from 'lucide-react';

export default function FoxyResponseRenderer({ content, onImportTrades }) {
  if (!content) return null;

  const [importedMap, setImportedMap] = useState({});
  const [importingMap, setImportingMap] = useState({});

  const handleImport = async (trades, cardKey) => {
    if (!onImportTrades || importingMap[cardKey]) return;
    setImportingMap(prev => ({ ...prev, [cardKey]: true }));
    try {
      await onImportTrades(trades);
      setImportedMap(prev => ({ ...prev, [cardKey]: true }));
    } catch (err) {
      console.error('Import error:', err);
    } finally {
      setImportingMap(prev => ({ ...prev, [cardKey]: false }));
    }
  };

  // Helper to parse inline bold, code, and currency/pl color highlights
  const parseInline = (text) => {
    if (!text) return null;

    // First handle bold and inline code: **text** and `code`
    const parts = text.split(/(\*\*.*?\*\*|`.*?`)/g);

    return parts.map((part, i) => {
      if (!part) return null;

      if (part.startsWith('**') && part.endsWith('**')) {
        const inner = part.slice(2, -2).trim();
        // Check if bold text is a P/L indicator
        if (inner.startsWith('▲') || inner.startsWith('+₹') || inner.includes('+')) {
          return (
            <strong key={i} style={{ fontWeight: 700, color: '#16a34a' }}>
              {inner}
            </strong>
          );
        }
        if (inner.startsWith('▼') || inner.startsWith('-₹') || (inner.includes('-') && inner.includes('₹'))) {
          return (
            <strong key={i} style={{ fontWeight: 700, color: '#dc2626' }}>
              {inner}
            </strong>
          );
        }
        return (
          <strong key={i} style={{ fontWeight: 700, color: '#111827' }}>
            {inner}
          </strong>
        );
      }

      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <code key={i} style={styles.code}>
            {part.slice(1, -1)}
          </code>
        );
      }

      // Format standalone green/red values (e.g. ▲ +₹12,400 or ▼ -₹3,500)
      if (part.includes('▲') || part.includes('▼')) {
        const subParts = part.split(/(▲\s*[\+₹\d,\.]+%?|▼\s*[\-₹\d,\.]+%?)/g);
        return subParts.map((sp, j) => {
          if (sp.startsWith('▲')) {
            return (
              <span key={`${i}-${j}`} style={{ color: '#16a34a', fontWeight: 600 }}>
                {sp}
              </span>
            );
          }
          if (sp.startsWith('▼')) {
            return (
              <span key={`${i}-${j}`} style={{ color: '#dc2626', fontWeight: 600 }}>
                {sp}
              </span>
            );
          }
          return sp;
        });
      }

      return part;
    });
  };

  // Smart table row tokenizer that NEVER splits commas inside numbers or parentheses
  const smartSplitRow = (rowStr, expectedCount) => {
    if (!rowStr) return [];

    // 1. Protect commas inside parentheses: (e.g., Pullback, Pivot Bo)
    let safe = rowStr.replace(/\(([^)]+)\)/g, (match) => match.replace(/,/g, '§COMMA§'));

    // 2. Protect commas inside Indian / currency numbers: e.g. 14,596 or 1,45,391 or ₹14,596.75
    for (let iter = 0; iter < 4; iter++) {
      safe = safe.replace(/(\d),(\d)/g, '$1§COMMA§$2');
    }

    // 3. Protect commas inside quotes if any: "a, b"
    safe = safe.replace(/"([^"]+)"/g, (match) => match.replace(/,/g, '§COMMA§'));

    // 4. Split by remaining unescaped commas
    let cells = safe.split(',').map(c => c.replace(/§COMMA§/g, ',').trim());

    // 5. If cells count exceeds expectedCount, merge extra cells into the last cell (remediation column)
    if (expectedCount && cells.length > expectedCount) {
      const head = cells.slice(0, expectedCount - 1);
      const tail = cells.slice(expectedCount - 1).join(', ');
      cells = [...head, tail];
    }

    return cells;
  };

  // Modern Institutional Table Component
  const renderModernTable = (hds, rows, key) => {
    if (!hds || hds.length === 0) return null;

    // Detect column roles for smart alignment & presentation
    const colMeta = hds.map(h => {
      const lower = (h || '').toLowerCase().trim();
      if (
        lower.includes('bleed') ||
        lower.includes('p&l') ||
        lower.includes('pnl') ||
        lower.includes('loss') ||
        lower.includes('profit') ||
        lower.includes('amount') ||
        lower.includes('friction') ||
        lower.includes('tax')
      ) {
        return { align: 'right', type: 'financial' };
      }
      if (
        lower.includes('trade') ||
        lower.includes('count') ||
        lower.includes('qty') ||
        lower.includes('score') ||
        lower.includes('wr') ||
        lower.includes('win rate') ||
        lower.includes('rate') ||
        lower.includes('grade')
      ) {
        return { align: 'center', type: 'metric' };
      }
      if (
        lower.includes('remediation') ||
        lower.includes('action') ||
        lower.includes('antidote') ||
        lower.includes('drill') ||
        lower.includes('rule') ||
        lower.includes('desc') ||
        lower.includes('note')
      ) {
        return { align: 'left', type: 'action' };
      }
      return { align: 'left', type: 'category' };
    });

    return (
      <div key={key} style={styles.tableCard}>
        <div style={styles.tableScrollWrapper}>
          <table style={styles.table}>
            <thead>
              <tr>
                {hds.map((h, i) => (
                  <th
                    key={i}
                    style={{
                      ...styles.th,
                      textAlign: colMeta[i]?.align || 'left'
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rIdx) => (
                <tr
                  key={rIdx}
                  style={rIdx % 2 === 0 ? styles.trEven : styles.trOdd}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = rIdx % 2 === 0 ? '#ffffff' : '#fafbfc'}
                >
                  {row.map((cell, cIdx) => {
                    const raw = (cell || '').trim();
                    const meta = colMeta[cIdx] || { align: 'left', type: 'category' };

                    // Financial detection: negative or positive
                    const isNegative = raw.startsWith('▼') || raw.startsWith('-₹') || (raw.includes('-') && raw.includes('₹'));
                    const isPositive = raw.startsWith('▲') || raw.startsWith('+₹') || (raw.includes('+') && raw.includes('₹'));
                    const isTradeCount = /^\d+\s*trades?$/i.test(raw);

                    let cellContent;

                    if (isNegative) {
                      cellContent = (
                        <span style={styles.pillNegative}>
                          {raw}
                        </span>
                      );
                    } else if (isPositive) {
                      cellContent = (
                        <span style={styles.pillPositive}>
                          {raw}
                        </span>
                      );
                    } else if (isTradeCount) {
                      cellContent = (
                        <span style={styles.pillNeutral}>
                          {raw}
                        </span>
                      );
                    } else if (meta.type === 'category') {
                      cellContent = (
                        <span style={{ fontWeight: 600, color: '#0f172a' }}>
                          {parseInline(raw)}
                        </span>
                      );
                    } else if (meta.type === 'action') {
                      cellContent = (
                        <span style={{ color: '#334155', lineHeight: '1.5' }}>
                          {parseInline(raw)}
                        </span>
                      );
                    } else {
                      cellContent = parseInline(raw);
                    }

                    return (
                      <td
                        key={cIdx}
                        style={{
                          ...styles.td,
                          textAlign: meta.align
                        }}
                      >
                        {cellContent}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // Parse [TABLE: header1,header2 | r1c1,r1c2 | r2c1,r2c2]
  const parseTable = (line, key) => {
    try {
      const closingIdx = line.lastIndexOf(']');
      if (closingIdx === -1) return null;
      const rawBody = line.slice(7, closingIdx).trim();
      const parts = rawBody.split('|').map(p => p.trim());
      if (parts.length < 2) return null;
      const hds = parts[0].split(',').map(h => h.trim());
      const rows = parts.slice(1).map(r => smartSplitRow(r, hds.length));

      return renderModernTable(hds, rows, key);
    } catch (err) {
      console.warn('[FoxyResponseRenderer] parseTable error:', err);
      return null;
    }
  };

  // Parse standard Markdown tables (| Col 1 | Col 2 | ...)
  const parseMarkdownTableLines = (tableLines, key) => {
    if (!tableLines || tableLines.length < 2) return null;

    const headerParts = tableLines[0].split('|').map(s => s.trim());
    const headers = headerParts.slice(1, headerParts.length - (headerParts[headerParts.length - 1] === '' ? 1 : undefined));

    const rows = [];
    for (let j = 2; j < tableLines.length; j++) {
      const line = tableLines[j];
      const rawCells = line.split('|').map(s => s.trim());
      const cells = rawCells.slice(1, rawCells.length - (rawCells[rawCells.length - 1] === '' ? 1 : undefined));
      if (cells.length > 0) rows.push(cells);
    }

    return renderModernTable(headers, rows, key);
  };

  // Parse [METRIC: Label | Value | color]
  const parseMetric = (line) => {
    const match = line.match(/\[METRIC:\s*(.*?)\s*\|\s*(.*?)\s*\|\s*(.*?)\]/);
    if (!match) return null;
    const [, label, value, color] = match;
    const colorKey = (color || '').toLowerCase().trim();
    const colorCode = styles.colors[colorKey] || styles.colors.blue;

    return (
      <div style={styles.metricCard}>
        <span style={styles.metricLabel}>{label}</span>
        <span style={{ ...styles.metricValue, color: colorCode }}>{value}</span>
      </div>
    );
  };

  // Parse [VERDICT: score | label | color]
  const parseVerdict = (line) => {
    const match = line.match(/\[VERDICT:\s*(.*?)\s*\|\s*(.*?)\s*\|\s*(.*?)\]/);
    if (!match) return null;
    const [, scoreStr, label, color] = match;
    const score = parseInt(scoreStr, 10) || 0;
    const colorKey = (color || '').toLowerCase().trim();
    const colorCode = styles.colors[colorKey] || styles.colors.blue;

    return (
      <div style={styles.verdictCard}>
        <div style={styles.verdictHeader}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '28px',
              height: '28px',
              borderRadius: '8px',
              backgroundColor: `${colorCode}15`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Sparkles size={15} color={colorCode} />
            </div>
            <span style={{ ...styles.verdictLabel, color: colorCode }}>{label}</span>
          </div>
          <span style={styles.verdictScore}>{score} <span style={{ fontSize: '13px', color: '#94a3b8', fontWeight: 500 }}>/ 100</span></span>
        </div>
        <div style={styles.verdictBarContainer}>
          <div style={{
            ...styles.verdictBarFill,
            width: `${Math.min(100, Math.max(0, score))}%`,
            background: `linear-gradient(90deg, ${colorCode}aa 0%, ${colorCode} 100%)`
          }}></div>
        </div>
      </div>
    );
  };

  // Parse [CHART: bar | Label1:val1,Label2:val2,...] — Beautiful institutional visualization
  const parseChart = (line) => {
    const match = line.match(/\[CHART:\s*(.*?)\s*\|\s*(.*?)\]/);
    if (!match) return null;
    const [, type, dataStr] = match;

    const chartType = (type || 'bar').toLowerCase().trim();

    if (chartType === 'bar' || chartType === 'column') {
      const dataPoints = dataStr.split(',').map(d => {
        const [k, v] = d.split(':');
        const num = parseFloat((v || '').trim().replace(/[^0-9.-]/g, '')) || 0;
        return { label: (k || '').trim(), value: num, rawText: (v || '').trim() };
      }).slice(0, 10);

      if (dataPoints.length === 0) return null;

      const maxVal = Math.max(...dataPoints.map(d => Math.abs(d.value)), 1);

      return (
        <div style={styles.chartWrapper}>
          <div style={styles.chartHeader}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <BarChart3 size={16} color="#3b82f6" />
              <span style={styles.chartTitle}>Visual Performance Breakdown</span>
            </div>
            <span style={styles.chartBadge}>FoxTrade Intelligence</span>
          </div>

          <div style={styles.chartBarsArea}>
            {dataPoints.map((dp, i) => {
              const pct = Math.max(8, Math.min(100, (Math.abs(dp.value) / maxVal) * 100));

              // Determine gradient based on value
              let barGradient = 'linear-gradient(180deg, #3b82f6 0%, #2563eb 100%)';
              let badgeColor = '#2563eb';
              if (dp.value >= 50) {
                barGradient = 'linear-gradient(180deg, #10b981 0%, #059669 100%)';
                badgeColor = '#059669';
              } else if (dp.value < 35 || dp.value < 0) {
                barGradient = 'linear-gradient(180deg, #f43f5e 0%, #dc2626 100%)';
                badgeColor = '#dc2626';
              } else if (dp.value < 50) {
                barGradient = 'linear-gradient(180deg, #f59e0b 0%, #d97706 100%)';
                badgeColor = '#d97706';
              }

              return (
                <div key={i} style={styles.barColumn}>
                  {/* Floating value badge above bar */}
                  <span style={{ ...styles.barValueBadge, color: badgeColor }}>
                    {dp.rawText || dp.value}
                  </span>

                  {/* Bar track and fill */}
                  <div style={styles.barTrack}>
                    <div style={{
                      ...styles.barFill,
                      height: `${pct}%`,
                      background: barGradient,
                      boxShadow: `0 2px 8px ${badgeColor}33`
                    }} />
                  </div>

                  {/* X-axis label */}
                  <span style={styles.barLabel} title={dp.label}>
                    {dp.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      );
    }
    return null;
  };

  // Parse [IMPORT_READY: [...]]
  const parseImportReady = (line, cardKey) => {
    try {
      const match = line.match(/\[IMPORT_READY:\s*([\s\S]*?)\]\s*$/);
      if (!match) return null;
      const jsonStr = match[1].trim();
      const rawTrades = JSON.parse(jsonStr);
      if (!Array.isArray(rawTrades) || rawTrades.length === 0) return null;

      const isImported = !!importedMap[cardKey];
      const isImporting = !!importingMap[cardKey];

      return (
        <div key={cardKey} style={styles.importCard}>
          <div style={styles.importHeader}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={styles.importBadge}>1-CLICK IMPORT READY</span>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#111827' }}>
                {rawTrades.length} Trade{rawTrades.length > 1 ? 's' : ''} Parsed & Verified
              </span>
            </div>
            <span style={{ fontSize: '12px', color: '#6b7280' }}>
              NSE/BSE Broker Contract Note
            </span>
          </div>

          <div style={styles.importTradeList}>
            {rawTrades.map((t, i) => (
              <div key={i} style={styles.importTradePill}>
                <span style={{ fontWeight: 700, color: t.side === 'Sell' ? styles.colors.red : styles.colors.green }}>
                  {t.side || 'BUY'}
                </span>
                <span style={{ fontWeight: 700, color: '#111827' }}>{t.symbol}</span>
                <span style={{ color: '#4b5563' }}>Qty: {t.qty}</span>
                <span style={{ color: '#4b5563' }}>@ ₹{t.price}</span>
                {t.sl ? <span style={{ color: '#9ca3af', fontSize: '11px' }}>SL: ₹{t.sl}</span> : null}
              </div>
            ))}
          </div>

          <div style={{ marginTop: '14px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px' }}>
            <button
              type="button"
              disabled={isImported || isImporting}
              onClick={() => handleImport(rawTrades, cardKey)}
              style={{
                ...styles.importButton,
                backgroundColor: isImported ? '#059669' : (isImporting ? '#9ca3af' : '#16a34a'),
                cursor: (isImported || isImporting) ? 'default' : 'pointer'
              }}
            >
              {isImported ? '✅ Imported to Journal!' : (isImporting ? '⏳ Importing...' : `📥 1-Click Import ${rawTrades.length} Trade${rawTrades.length > 1 ? 's' : ''} to Journal`)}
            </button>
          </div>
        </div>
      );
    } catch (e) {
      console.error('Failed to parse IMPORT_READY token:', e);
      return null;
    }
  };

  const renderLines = () => {
    const rawLines = (content || '').split('\n');
    const elements = [];
    let currentMetricsRow = [];

    const flushMetrics = () => {
      if (currentMetricsRow.length > 0) {
        elements.push(
          <div style={styles.metricsRow} key={`metrics-${elements.length}`}>
            {currentMetricsRow}
          </div>
        );
        currentMetricsRow = [];
      }
    };

    let i = 0;
    while (i < rawLines.length) {
      const line = rawLines[i];
      const trimmed = line.trim();

      // Empty line / paragraph break
      if (!trimmed) {
        flushMetrics();
        i++;
        continue;
      }

      // Check for Markdown table block (starts and ends with |)
      if (
        trimmed.startsWith('|') &&
        trimmed.endsWith('|') &&
        i + 1 < rawLines.length &&
        rawLines[i + 1].trim().startsWith('|') &&
        /\|[\s-:]+\|/.test(rawLines[i + 1].trim())
      ) {
        flushMetrics();
        const tableLines = [];
        while (i < rawLines.length && rawLines[i].trim().startsWith('|') && rawLines[i].trim().endsWith('|')) {
          tableLines.push(rawLines[i].trim());
          i++;
        }
        const rendered = parseMarkdownTableLines(tableLines, `md-table-${elements.length}`);
        if (rendered) elements.push(rendered);
        continue;
      }

      // Divider lines (---, ***, ═════)
      if (/^[-*_]{3,}$/.test(trimmed) || /^[═=─]{4,}$/.test(trimmed)) {
        flushMetrics();
        elements.push(<div key={`div-${i}`} style={styles.hairlineDivider} />);
        i++;
        continue;
      }

      // Generative UI: Metric
      if (trimmed.startsWith('[METRIC:')) {
        const metric = parseMetric(trimmed);
        if (metric) {
          currentMetricsRow.push(React.cloneElement(metric, { key: `m-${i}` }));
          if (currentMetricsRow.length >= 3) flushMetrics();
        } else {
          flushMetrics();
          elements.push(<p key={`p-${i}`} style={styles.text}>{parseInline(trimmed)}</p>);
        }
        i++;
        continue;
      }

      // Generative UI: Table
      if (trimmed.startsWith('[TABLE:')) {
        flushMetrics();
        const table = parseTable(trimmed, `table-${elements.length}`);
        if (table) elements.push(table);
        else elements.push(<p key={`p-${i}`} style={styles.text}>{parseInline(trimmed)}</p>);
        i++;
        continue;
      }

      // Generative UI: Verdict
      if (trimmed.startsWith('[VERDICT:')) {
        flushMetrics();
        const verdict = parseVerdict(trimmed);
        if (verdict) elements.push(React.cloneElement(verdict, { key: `v-${i}` }));
        else elements.push(<p key={`p-${i}`} style={styles.text}>{parseInline(trimmed)}</p>);
        i++;
        continue;
      }

      // Generative UI: Chart
      if (trimmed.startsWith('[CHART:')) {
        flushMetrics();
        const chart = parseChart(trimmed);
        if (chart) elements.push(React.cloneElement(chart, { key: `c-${i}` }));
        else elements.push(<p key={`p-${i}`} style={styles.text}>{parseInline(trimmed)}</p>);
        i++;
        continue;
      }

      // Generative UI: Import Ready Card
      if (trimmed.startsWith('[IMPORT_READY:')) {
        flushMetrics();
        const importCard = parseImportReady(trimmed, `import-${i}`);
        if (importCard) elements.push(importCard);
        else elements.push(<p key={`p-${i}`} style={styles.text}>{parseInline(trimmed)}</p>);
        i++;
        continue;
      }

      flushMetrics();

      // Heading line with #, ##, ###, ####, etc. (STRIP RAW HASHES AND RENDER AS BOLD CLEAN HEADING)
      const headingMatch = trimmed.match(/^#{1,6}\s*(.*)$/);
      if (headingMatch) {
        const headingText = headingMatch[1].replace(/^[#\s]+/, '').trim();
        if (headingText) {
          elements.push(
            <div key={`h-${i}`} style={styles.boldHeading}>
              <span style={styles.headingAccent} />
              <span style={styles.headingTitle}>{parseInline(headingText)}</span>
            </div>
          );
        }
        i++;
        continue;
      }

      // Line that is solely a bold title (e.g. **Section Title:** or **Title**)
      const boldTitleMatch = trimmed.match(/^\*\*([^*]+)\*\*:?$/);
      if (boldTitleMatch) {
        elements.push(
          <div key={`bh-${i}`} style={styles.boldHeading}>
            <span style={styles.headingAccent} />
            <span style={styles.headingTitle}>{boldTitleMatch[1]}</span>
          </div>
        );
        i++;
        continue;
      }

      // Bullet Point / Pointer Line (*, -, •, or 1.) -> USE POINTER INSTEAD OF STAR
      const bulletMatch = trimmed.match(/^([\*•\-]|\d+\.)\s+(.*)$/);
      if (bulletMatch) {
        const bulletContent = bulletMatch[2].trim();
        elements.push(
          <div key={`bullet-${i}`} style={styles.pointerItem}>
            <span style={styles.pointerBullet}>•</span>
            <div style={styles.pointerContent}>
              {parseInline(bulletContent)}
            </div>
          </div>
        );
        i++;
        continue;
      }

      // Regular clean paragraph
      elements.push(
        <p key={`p-${i}`} style={styles.text}>
          {parseInline(trimmed)}
        </p>
      );
      i++;
    }

    flushMetrics();
    return elements;
  };

  return <div style={styles.container}>{renderLines()}</div>;
}

const styles = {
  colors: {
    green: '#16a34a',
    red: '#dc2626',
    blue: '#2563eb',
    orange: '#d97706',
    gray: '#64748b',
    border: '#e2e8f0',
    bgLight: '#f8fafc'
  },
  container: {
    fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
    lineHeight: 1.65,
    color: '#334155',
    fontSize: '13.5px'
  },
  text: {
    margin: '0 0 10px 0',
    color: '#334155'
  },
  boldHeading: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginTop: '18px',
    marginBottom: '8px'
  },
  headingAccent: {
    width: '3.5px',
    height: '15px',
    borderRadius: '2px',
    backgroundColor: '#3b82f6',
    flexShrink: 0
  },
  headingTitle: {
    fontSize: '14.5px',
    fontWeight: 700,
    color: '#0f172a',
    letterSpacing: '-0.15px'
  },
  pointerItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '9px',
    margin: '4px 0 6px 0'
  },
  pointerBullet: {
    color: '#3b82f6',
    fontSize: '16px',
    lineHeight: '1.45',
    fontWeight: 700,
    flexShrink: 0,
    userSelect: 'none'
  },
  pointerContent: {
    flex: 1,
    minWidth: 0,
    fontSize: '13.5px',
    lineHeight: 1.6,
    color: '#334155'
  },
  hairlineDivider: {
    height: '1px',
    backgroundColor: '#f1f5f9',
    margin: '14px 0'
  },
  code: {
    backgroundColor: '#f1f5f9',
    padding: '2px 6px',
    borderRadius: '5px',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, monospace',
    fontSize: '12px',
    color: '#0f172a',
    border: '1px solid #e2e8f0'
  },
  metricsRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
    margin: '10px 0 14px 0'
  },
  metricCard: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    backgroundColor: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: '20px',
    padding: '6px 14px',
    fontSize: '12.5px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
  },
  metricLabel: {
    color: '#64748b',
    fontWeight: 500,
    fontSize: '12px'
  },
  metricValue: {
    fontWeight: 700,
    fontSize: '13px'
  },
  tableCard: {
    margin: '18px 0',
    borderRadius: '14px',
    border: '1px solid #e2e8f0',
    backgroundColor: '#ffffff',
    boxShadow: '0 2px 10px rgba(0, 0, 0, 0.03)',
    overflow: 'hidden'
  },
  tableScrollWrapper: {
    overflowX: 'auto',
    width: '100%'
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    textAlign: 'left',
    fontSize: '13px'
  },
  th: {
    backgroundColor: '#f8fafc',
    color: '#475569',
    padding: '12px 18px',
    fontWeight: 700,
    fontSize: '11px',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    borderBottom: '1px solid #e2e8f0',
    whiteSpace: 'nowrap'
  },
  td: {
    padding: '13px 18px',
    borderBottom: '1px solid #f1f5f9',
    color: '#1e293b',
    fontSize: '13px',
    lineHeight: '1.5',
    verticalAlign: 'middle'
  },
  trEven: {
    backgroundColor: '#ffffff',
    transition: 'background-color 0.15s ease'
  },
  trOdd: {
    backgroundColor: '#fafbfc',
    transition: 'background-color 0.15s ease'
  },
  pillNegative: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '3px 9px',
    borderRadius: '6px',
    backgroundColor: '#fef2f2',
    border: '1px solid #fecaca',
    color: '#dc2626',
    fontWeight: 700,
    fontSize: '12px',
    whiteSpace: 'nowrap',
    letterSpacing: '-0.1px'
  },
  pillPositive: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '3px 9px',
    borderRadius: '6px',
    backgroundColor: '#f0fdf4',
    border: '1px solid #bbf7d0',
    color: '#16a34a',
    fontWeight: 700,
    fontSize: '12px',
    whiteSpace: 'nowrap',
    letterSpacing: '-0.1px'
  },
  pillNeutral: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '3px 9px',
    borderRadius: '6px',
    backgroundColor: '#f1f5f9',
    border: '1px solid #e2e8f0',
    color: '#475569',
    fontWeight: 600,
    fontSize: '11.5px',
    whiteSpace: 'nowrap'
  },
  verdictCard: {
    border: '1px solid #e2e8f0',
    borderRadius: '12px',
    padding: '14px 16px',
    margin: '14px 0',
    backgroundColor: '#ffffff',
    boxShadow: '0 2px 6px rgba(0,0,0,0.03)'
  },
  verdictHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '10px'
  },
  verdictScore: {
    fontSize: '1.25rem',
    fontWeight: 800,
    color: '#0f172a'
  },
  verdictLabel: {
    fontWeight: 700,
    fontSize: '12.5px',
    textTransform: 'uppercase',
    letterSpacing: '0.04em'
  },
  verdictBarContainer: {
    height: '6px',
    backgroundColor: '#f1f5f9',
    borderRadius: '9999px',
    overflow: 'hidden'
  },
  verdictBarFill: {
    height: '100%',
    borderRadius: '9999px',
    transition: 'width 0.4s ease'
  },
  chartWrapper: {
    backgroundColor: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: '14px',
    padding: '16px 18px',
    margin: '16px 0',
    boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
  },
  chartHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
    paddingBottom: '10px',
    borderBottom: '1px solid #f1f5f9'
  },
  chartTitle: {
    fontSize: '13px',
    fontWeight: 700,
    color: '#0f172a'
  },
  chartBadge: {
    fontSize: '11px',
    fontWeight: 600,
    color: '#64748b',
    backgroundColor: '#f8fafc',
    padding: '2px 8px',
    borderRadius: '6px',
    border: '1px solid #e2e8f0'
  },
  chartBarsArea: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: '16px',
    height: '150px',
    padding: '14px 10px 6px 10px',
    overflowX: 'auto'
  },
  barColumn: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    height: '100%',
    flex: '1 1 0%',
    minWidth: '42px',
    maxWidth: '56px',
    justifyContent: 'flex-end'
  },
  barValueBadge: {
    fontSize: '10.5px',
    fontWeight: 700,
    marginBottom: '6px',
    textAlign: 'center',
    whiteSpace: 'nowrap'
  },
  barTrack: {
    width: '100%',
    maxWidth: '32px',
    height: '84px',
    backgroundColor: '#f1f5f9',
    borderRadius: '6px 6px 0 0',
    display: 'flex',
    alignItems: 'flex-end',
    overflow: 'hidden'
  },
  barFill: {
    width: '100%',
    borderRadius: '6px 6px 0 0',
    transition: 'height 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
  },
  barLabel: {
    fontSize: '11px',
    fontWeight: 600,
    color: '#64748b',
    marginTop: '6px',
    textAlign: 'center',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: '56px'
  },
  importCard: {
    border: '1px solid #bbf7d0',
    backgroundColor: '#f0fdf4',
    borderRadius: '12px',
    padding: '16px',
    margin: '14px 0',
    boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
  },
  importHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '8px',
    marginBottom: '10px'
  },
  importBadge: {
    backgroundColor: '#dcfce7',
    color: '#15803d',
    padding: '3px 8px',
    borderRadius: '6px',
    fontSize: '11px',
    fontWeight: 800,
    letterSpacing: '0.04em'
  },
  importTradeList: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
    marginTop: '6px'
  },
  importTradePill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    backgroundColor: '#ffffff',
    border: '1px solid #dcfce7',
    padding: '4px 10px',
    borderRadius: '6px',
    fontSize: '12px'
  },
  importButton: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    color: '#ffffff',
    border: 'none',
    borderRadius: '8px',
    padding: '8px 16px',
    fontSize: '13px',
    fontWeight: 700,
    boxShadow: '0 1px 3px rgba(22,163,74,0.3)',
    transition: 'all 0.15s ease'
  }
};
