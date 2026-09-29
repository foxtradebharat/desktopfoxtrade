import React, { useState, useEffect } from 'react';
import { X, Send, Sparkles, CheckCircle2, MessageSquare, ArrowRight, Zap, Bot } from 'lucide-react';
import { parseNaturalTradeMessage } from '../services/nlpTradeService';

export default function QuickLogModal({ isOpen, onClose, onSaveTrade }) {
  const [inputMessage, setInputMessage] = useState('');
  const [parsedTrade, setParsedTrade] = useState(null);
  const [chatLog, setChatLog] = useState([
    {
      sender: 'bot',
      text: 'Namaste! Just message your trade in plain English or shorthand, e.g.:\n"Sold NIFTY 23200 CE at 285. Entry was 210. FOMO trade"\nor "Bought 50 TATASTEEL at 165 sold at 178 calm"',
      time: 'Just now'
    }
  ]);

  const PRESETS = [
    'Sold NIFTY 23200 CE at 285. Entry was 210. FOMO trade',
    'banknifty 51500 pe bought 2 lots @ 340 exited 410 target achieved',
    'Bought 100 TATASTEEL at 165 sold at 178 Breakout Setup',
    'RELIANCE buy 25 qty 2950 sl 2900 tp 3050'
  ];

  // Parse in real-time as user types
  useEffect(() => {
    if (inputMessage.trim().length > 5) {
      const parsed = parseNaturalTradeMessage(inputMessage);
      setParsedTrade(parsed);
    } else {
      setParsedTrade(null);
    }
  }, [inputMessage]);

  if (!isOpen) return null;

  const handleSend = () => {
    if (!inputMessage.trim()) return;

    const parsed = parseNaturalTradeMessage(inputMessage);
    const userMsg = {
      sender: 'user',
      text: inputMessage,
      time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false })
    };

    let replyText = '';
    if (parsed) {
      const pnlStr = parsed.status === 'Closed' 
        ? `${parsed.pnl >= 0 ? '+₹' : '-₹'}${Math.abs(parsed.pnl).toLocaleString('en-IN')}` 
        : 'Open Position';
      replyText = `✅ Trade Parsed & Ready!\nSymbol: ${parsed.symbol}\nType: ${parsed.type} (${parsed.qty} Qty)\nEntry: ₹${parsed.avgEntry} | Exit: ₹${parsed.avgExit || 'Active'}\nP&L: ${pnlStr}\nEmotion: ${parsed.emotion}`;
    } else {
      replyText = "⚠️ Couldn't detect trade details clearly. Please include instrument name and entry/exit price.";
    }

    const botMsg = {
      sender: 'bot',
      text: replyText,
      time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false })
    };

    setChatLog(prev => [...prev, userMsg, botMsg]);
    setInputMessage('');
  };

  const handleConfirmAndSave = () => {
    if (parsedTrade && onSaveTrade) {
      onSaveTrade(parsedTrade);
      onClose();
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 1000,
      backgroundColor: 'rgba(0, 0, 0, 0.65)',
      backdropFilter: 'blur(6px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '560px',
        backgroundColor: 'var(--bg-card, #ffffff)',
        borderRadius: '20px',
        border: '1px solid var(--border-color, #e5e7eb)',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        maxHeight: '90vh'
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-color, #e5e7eb)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: '#059669',
          color: '#ffffff'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <MessageSquare size={18} color="#ffffff" />
            </div>
            <div>
              <div style={{ fontSize: '15px', fontWeight: 700 }}>WhatsApp & NLP Quick-Logger</div>
              <div style={{ fontSize: '11px', opacity: 0.9 }}>Frictionless conversational trade entry</div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#ffffff',
              cursor: 'pointer',
              padding: '4px',
              borderRadius: '50%'
            }}>
            <X size={18} />
          </button>
        </div>

        {/* Chat Stream */}
        <div style={{
          padding: '16px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          flex: 1,
          overflowY: 'auto',
          minHeight: '220px',
          maxHeight: '300px',
          backgroundColor: 'var(--bg-primary, #f9fafb)'
        }}>
          {chatLog.map((msg, i) => (
            <div
              key={i}
              style={{
                alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '85%',
                backgroundColor: msg.sender === 'user' ? '#059669' : 'var(--bg-card, #ffffff)',
                color: msg.sender === 'user' ? '#ffffff' : 'var(--text-primary, #111827)',
                padding: '10px 14px',
                borderRadius: msg.sender === 'user' ? '16px 16px 2px 16px' : '16px 16px 16px 2px',
                border: msg.sender === 'bot' ? '1px solid var(--border-color, #e5e7eb)' : 'none',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
                fontSize: '13px',
                lineHeight: 1.4,
                whiteSpace: 'pre-line'
              }}>
              <div>{msg.text}</div>
              <div style={{
                fontSize: '10px',
                opacity: 0.7,
                textAlign: 'right',
                marginTop: '4px'
              }}>
                {msg.time}
              </div>
            </div>
          ))}
        </div>

        {/* Quick Presets */}
        <div style={{
          padding: '8px 16px',
          backgroundColor: 'var(--bg-card, #ffffff)',
          borderTop: '1px solid var(--border-color, #e5e7eb)',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          overflowX: 'auto',
          whiteSpace: 'nowrap'
        }}>
          <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted, #6b7280)' }}>Presets:</span>
          {PRESETS.map((p, idx) => (
            <button
              key={idx}
              onClick={() => setInputMessage(p)}
              style={{
                padding: '4px 10px',
                borderRadius: '9999px',
                backgroundColor: 'var(--bg-primary, #f3f4f6)',
                border: '1px solid var(--border-color, #e5e7eb)',
                fontSize: '11px',
                color: 'var(--text-primary, #374151)',
                cursor: 'pointer',
                flexShrink: 0
              }}>
              {p.split(' ')[0]} {p.split(' ')[1]}
            </button>
          ))}
        </div>

        {/* Live Parsed Preview Card */}
        {parsedTrade && (
          <div style={{
            padding: '12px 16px',
            backgroundColor: 'rgba(5, 150, 105, 0.08)',
            borderTop: '1px solid rgba(5, 150, 105, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
              <Sparkles size={16} color="#059669" />
              <div style={{ fontSize: '12px', color: '#065f46', fontWeight: 600, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                Detected: <span style={{ fontWeight: 800 }}>{parsedTrade.symbol}</span> | {parsedTrade.qty} Qty | ₹{parsedTrade.avgEntry} → ₹{parsedTrade.avgExit || 'Open'} | {parsedTrade.pnl >= 0 ? `+₹${parsedTrade.pnl}` : `-₹${Math.abs(parsedTrade.pnl)}`}
              </div>
            </div>
            <button
              onClick={handleConfirmAndSave}
              style={{
                padding: '6px 14px',
                backgroundColor: '#059669',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                flexShrink: 0
              }}>
              <CheckCircle2 size={13} />
              Save to Journal
            </button>
          </div>
        )}

        {/* Input Bar */}
        <div style={{
          padding: '12px 16px',
          borderTop: '1px solid var(--border-color, #e5e7eb)',
          display: 'flex',
          gap: '8px',
          backgroundColor: 'var(--bg-card, #ffffff)'
        }}>
          <input
            type="text"
            placeholder="e.g. Sold NIFTY 23200 CE at 285 entry was 210 FOMO..."
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSend();
            }}
            style={{
              flex: 1,
              padding: '10px 14px',
              borderRadius: '10px',
              border: '1px solid var(--border-color, #d1d5db)',
              fontSize: '13px',
              outline: 'none',
              backgroundColor: 'var(--bg-primary, #ffffff)',
              color: 'var(--text-primary, #111827)'
            }}
            autoFocus
          />
          <button
            onClick={handleSend}
            style={{
              padding: '10px 16px',
              backgroundColor: '#059669',
              color: '#ffffff',
              border: 'none',
              borderRadius: '10px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
            <Send size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
