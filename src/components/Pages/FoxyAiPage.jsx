import React, { useState, useEffect, useRef } from 'react';
import { 
  Sparkles, Bot, Plus, Send, ChevronDown, ChevronRight, PanelLeftClose, PanelLeftOpen, 
  Trash2, Settings, ArrowLeft, Mic, ShieldAlert, Target, 
  TrendingDown, TrendingUp, AlertTriangle, Check, Copy, Zap, ShieldCheck,
  CalendarCheck, BookmarkCheck, Award, Tag, FileSpreadsheet,
  Pin, MoreHorizontal, Pencil, SquarePen, Search, MessageSquare
} from 'lucide-react';
import FoxTradeLogo from '../FoxTradeLogo';
import FoxySettingsModal from './FoxySettingsModal';
import FoxyPreTradePanel from './FoxyPreTradePanel';
import FoxyResponseRenderer from '../FoxyResponseRenderer';
import { bulkPutTrades } from '../../db';
import { formatExtractedTradesForJournal } from '../../utils/contractNoteParser';
import { 
  getFoxyConfig, 
  askFoxy, 
  getFoxyChatHistory, 
  saveFoxyChatHistory,
  AI_PROVIDERS
} from '../../services/foxyAiService';

const QUICK_STARTERS = [
  { icon: TrendingDown, label: 'Why am I losing money this month?', prompt: 'Analyze my trades and diagnose my main performance leaks and reasons for losses.' },
  { icon: ShieldAlert, label: 'Audit open risk & stop losses', prompt: 'Audit all my active open trades. Which positions have no stop loss, and what is my total open risk?' },
  { icon: Target, label: 'What is my most profitable setup?', prompt: 'Break down my performance by setup and strategy. Which setup has my highest expectancy and win rate?' },
  { icon: AlertTriangle, label: 'Detect revenge trading habits', prompt: 'Analyze my trading history for behavioral biases: am I sizing up or revenge trading after taking a loss?' }
];

function parseInline(str) {
  if (!str) return '';
  const parts = [];
  const regex = /(\*\*.*?\*\*|`.*?`)/g;
  let lastIndex = 0;
  let match;
  while ((match = regex.exec(str)) !== null) {
    if (match.index > lastIndex) {
      parts.push(str.substring(lastIndex, match.index));
    }
    const token = match[0];
    if (token.startsWith('**') && token.endsWith('**')) {
      parts.push(<strong key={match.index} style={{ fontWeight: 700, color: '#111827' }}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith('`') && token.endsWith('`')) {
      parts.push(
        <code key={match.index} style={{
          backgroundColor: '#f3f4f6',
          padding: '2px 5px',
          borderRadius: '4px',
          fontSize: '12.5px',
          fontFamily: 'monospace',
          color: '#1f2937'
        }}>
          {token.slice(1, -1)}
        </code>
      );
    }
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < str.length) {
    parts.push(str.substring(lastIndex));
  }
  return parts.length > 0 ? parts : str;
}

function renderFormattedContent(text) {
  if (!text) return null;
  const lines = text.split('\n');
  return lines.map((line, lIdx) => {
    if (line.startsWith('### ')) {
      return (
        <h4 key={lIdx} style={{ fontSize: '15px', fontWeight: 700, margin: '10px 0 6px 0', color: '#111827' }}>
          {parseInline(line.slice(4))}
        </h4>
      );
    }
    if (line.startsWith('## ')) {
      return (
        <h3 key={lIdx} style={{ fontSize: '16px', fontWeight: 700, margin: '12px 0 6px 0', color: '#111827' }}>
          {parseInline(line.slice(3))}
        </h3>
      );
    }
    if (line.startsWith('# ')) {
      return (
        <h2 key={lIdx} style={{ fontSize: '18px', fontWeight: 800, margin: '14px 0 8px 0', color: '#111827' }}>
          {parseInline(line.slice(2))}
        </h2>
      );
    }
    if (line.startsWith('- ') || line.startsWith('* ') || line.startsWith('• ')) {
      return (
        <div key={lIdx} style={{ display: 'flex', gap: '8px', margin: '3px 0', paddingLeft: '4px' }}>
          <span style={{ color: '#6b7280' }}>•</span>
          <span style={{ flex: 1 }}>{parseInline(line.slice(2))}</span>
        </div>
      );
    }
    const numMatch = line.match(/^(\d+)\.\s+(.*)/);
    if (numMatch) {
      return (
        <div key={lIdx} style={{ display: 'flex', gap: '8px', margin: '3px 0', paddingLeft: '4px' }}>
          <span style={{ color: '#6b7280', fontWeight: 600 }}>{numMatch[1]}.</span>
          <span style={{ flex: 1 }}>{parseInline(numMatch[2])}</span>
        </div>
      );
    }
    if (!line.trim()) {
      return <div key={lIdx} style={{ height: '6px' }} />;
    }
    return (
      <p key={lIdx} style={{ margin: '3px 0', lineHeight: '1.6' }}>
        {parseInline(line)}
      </p>
    );
  });
}

export default function FoxyAiPage({ trades = [], metrics = null, user, onBackToJournal, activePortfolioId = 'portfolio-default', portfolioCapital = 0 }) {

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isPreTradeOpen, setIsPreTradeOpen] = useState(false);
  const [foxyConfig, setFoxyConfig] = useState({ provider: 'gemini', model: 'gemini-2.5-flash', apiKey: '' });
  
  // Chats & conversation state
  const [chats, setChats] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [savedJournalIndex, setSavedJournalIndex] = useState(null);

  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const [plusMenuOpen, setPlusMenuOpen] = useState(false);
  const plusMenuRef = useRef(null);
  const plusBtnRef = useRef(null);

  // Sidebar chat states: Collapsible, Pinned, Rename, and 3-Dot Menu
  const [recentCollapsed, setRecentCollapsed] = useState(false);
  const [pinnedCollapsed, setPinnedCollapsed] = useState(false);
  const [hoveredChatId, setHoveredChatId] = useState(null);
  const [menuOpenChatId, setMenuOpenChatId] = useState(null);
  const [editingChatId, setEditingChatId] = useState(null);
  const [editingTitle, setEditingTitle] = useState('');
  const chatMenuRef = useRef(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchInputRef = useRef(null);

  // Close chat 3-dot menu on outside click or escape
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (e.target.closest && e.target.closest('[data-chat-menu-btn]')) return;
      if (chatMenuRef.current && !chatMenuRef.current.contains(e.target)) {
        setMenuOpenChatId(null);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setMenuOpenChatId(null);
        setEditingChatId(null);
      }
    };
    if (menuOpenChatId) {
      document.addEventListener('mousedown', handleClickOutside);
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [menuOpenChatId]);

  // Close plus menu on outside click or escape
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        plusMenuRef.current && !plusMenuRef.current.contains(e.target) &&
        (!plusBtnRef.current || !plusBtnRef.current.contains(e.target))
      ) {
        setPlusMenuOpen(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setPlusMenuOpen(false);
    };

    if (plusMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [plusMenuOpen]);

  // Load config and chat history on mount
  useEffect(() => {
    getFoxyConfig().then(cfg => setFoxyConfig(cfg));
    getFoxyChatHistory().then(savedChats => {
      if (savedChats && savedChats.length > 0) {
        setChats(savedChats);
        setActiveChatId(savedChats[0].id);
        setMessages(savedChats[0].messages || []);
      } else {
        createNewChat();
      }
    });
  }, []);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Adjust textarea height automatically
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
    }
  }, [inputValue]);

  const createNewChat = () => {
    const newChat = {
      id: `chat_${Date.now()}`,
      title: 'New conversation',
      createdAt: Date.now(),
      isPinned: false,
      messages: []
    };
    setChats(prev => {
      const updated = [newChat, ...prev];
      saveFoxyChatHistory(updated);
      return updated;
    });
    setActiveChatId(newChat.id);
    setMessages([]);
    setInputValue('');
  };

  const selectChat = (chatId) => {
    setActiveChatId(chatId);
    const chat = chats.find(c => c.id === chatId);
    setMessages(chat?.messages || []);
  };

  const togglePinChat = (e, chatId) => {
    if (e) e.stopPropagation();
    setChats(prev => {
      const updated = prev.map(c => c.id === chatId ? { ...c, isPinned: !c.isPinned } : c);
      saveFoxyChatHistory(updated);
      return updated;
    });
  };

  const startRenameChat = (e, chat) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    setMenuOpenChatId(null);
    setEditingChatId(chat.id);
    setEditingTitle(chat.title || 'Untitled chat');
  };

  const saveRenameChat = (chatId) => {
    const trimmed = editingTitle.trim();
    if (trimmed) {
      setChats(prev => {
        const updated = prev.map(c => c.id === chatId ? { ...c, title: trimmed } : c);
        saveFoxyChatHistory(updated);
        return updated;
      });
    }
    setEditingChatId(null);
  };

  const deleteChat = (e, chatId) => {
    if (e) e.stopPropagation();
    setMenuOpenChatId(null);
    if (editingChatId === chatId) setEditingChatId(null);
    setChats(prev => {
      const updated = prev.filter(c => c.id !== chatId);
      saveFoxyChatHistory(updated);
      if (activeChatId === chatId) {
        if (updated.length > 0) {
          setActiveChatId(updated[0].id);
          setMessages(updated[0].messages || []);
        } else {
          createNewChat();
        }
      }
      return updated;
    });
  };

  const handleSendMessage = async (textToSend) => {
    const text = (textToSend || inputValue).trim();
    if (!text || isLoading) return;

    setInputValue('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    const userMessage = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: Date.now()
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setIsLoading(true);

    // Update chat title if first message
    const currentChat = chats.find(c => c.id === activeChatId);
    let updatedTitle = currentChat?.title;
    if (!currentChat || currentChat.messages.length === 0 || currentChat.title === 'New conversation') {
      updatedTitle = text.slice(0, 36) + (text.length > 36 ? '...' : '');
    }

    try {
      const aiResponse = await askFoxy({
        prompt: text,
        conversationHistory: newMessages,
        trades: trades,
        metrics: metrics,
        portfolioId: activePortfolioId,
        portfolioCapital: portfolioCapital
      });


      const assistantMessage = {
        id: `msg_${Date.now() + 1}`,
        role: 'assistant',
        content: aiResponse,
        timestamp: Date.now()
      };

      const finalMessages = [...newMessages, assistantMessage];
      setMessages(finalMessages);

      // Save to chat history
      setChats(prev => {
        const updated = prev.map(c => {
          if (c.id === activeChatId) {
            return { ...c, title: updatedTitle, messages: finalMessages, updatedAt: Date.now() };
          }
          return c;
        });
        saveFoxyChatHistory(updated);
        return updated;
      });

    } catch (err) {
      const errorMessage = {
        id: `msg_${Date.now() + 1}`,
        role: 'assistant',
        content: `⚠️ **Error connecting to ${foxyConfig.provider.toUpperCase()}**: ${err.message}\n\nPlease verify your API key in **Configure LLM** in the top bar.`,
        timestamp: Date.now()
      };
      setMessages([...newMessages, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const copyToClipboard = (text, idx) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleSaveToJournal = (text, idx) => {
    try {
      // Clean tags like [METRIC: ...], [VERDICT: ...], [TABLE: ...] for clean note reading
      const cleanContent = text
        .replace(/\[(METRIC|VERDICT|TABLE|CHART):.*?\]/gi, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();

      // 1. Save to Quick Notes ('tradeontip_quick_notes')
      const savedQuick = localStorage.getItem('tradeontip_quick_notes');
      const existingQuick = savedQuick ? JSON.parse(savedQuick) : [];
      const newQuickNote = {
        id: Date.now(),
        date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
        title: 'Foxy AI EOD Session Review',
        content: cleanContent,
        tag: 'AI Session Review'
      };
      localStorage.setItem('tradeontip_quick_notes', JSON.stringify([newQuickNote, ...existingQuick]));

      // 2. Save to NotesPage Independent Notes ('foxtrade_independent_notes_v2')
      const savedInd = localStorage.getItem('foxtrade_independent_notes_v2');
      const existingInd = savedInd ? JSON.parse(savedInd) : [];
      const newIndNote = {
        id: `foxy_eod_${Date.now()}`,
        title: 'Foxy AI EOD Session Review',
        content: cleanContent,
        category: 'notes',
        tags: ['Foxy AI', 'EOD Review'],
        pinned: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      localStorage.setItem('foxtrade_independent_notes_v2', JSON.stringify([newIndNote, ...existingInd]));

      // 3. Save to Daily Calendar notes ('foxtrade_notes_v2') under the target date
      const dateMatch = cleanContent.match(/(\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2}[-/]\d{4})/);
      let targetDateKey = new Date().toISOString().slice(0, 10);
      if (dateMatch) {
        const rawMatch = dateMatch[1];
        const ymd = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/.exec(rawMatch);
        const dmy = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/.exec(rawMatch);
        if (ymd) targetDateKey = `${ymd[1]}-${String(ymd[2]).padStart(2,'0')}-${String(ymd[3]).padStart(2,'0')}`;
        else if (dmy) targetDateKey = `${dmy[3]}-${String(dmy[2]).padStart(2,'0')}-${String(dmy[1]).padStart(2,'0')}`;
      }

      const savedDaily = localStorage.getItem('foxtrade_notes_v2');
      const existingDaily = savedDaily ? JSON.parse(savedDaily) : {};
      const currentDay = existingDaily[targetDateKey] || {};
      const updatedScoped = {
        ...(currentDay.scopedNotes || {}),
        general: {
          title: 'Foxy AI EOD Session Review',
          content: cleanContent,
          tags: ['Foxy AI', 'EOD Review'],
          mood: 'good',
          scope: 'general'
        }
      };
      existingDaily[targetDateKey] = {
        ...currentDay,
        title: currentDay.title || 'Foxy AI EOD Session Review',
        content: cleanContent,
        tags: Array.from(new Set([...(currentDay.tags || []), 'Foxy AI', 'EOD Review'])),
        mood: currentDay.mood || 'good',
        scopedNotes: updatedScoped
      };
      localStorage.setItem('foxtrade_notes_v2', JSON.stringify(existingDaily));

      setSavedJournalIndex(idx);
      setTimeout(() => setSavedJournalIndex(null), 3000);
    } catch (e) {
      console.error('Failed to save to journal notes:', e);
    }
  };

  const handleImportTrades = async (parsedTrades) => {
    try {
      if (!parsedTrades || parsedTrades.length === 0) return 0;
      const formatted = formatExtractedTradesForJournal(parsedTrades, activePortfolioId);
      const count = await bulkPutTrades(activePortfolioId, formatted);
      try {
        window.dispatchEvent(new CustomEvent('foxtrade:trades-updated', { detail: { portfolioId: activePortfolioId } }));
      } catch (evErr) {}
      return count;
    } catch (err) {
      console.error('Failed to import trades into journal:', err);
      throw err;
    }
  };

  const currentProviderObj = AI_PROVIDERS.find(p => p.id === foxyConfig.provider) || AI_PROVIDERS[0];
  const currentModelObj = currentProviderObj.models.find(m => m.id === foxyConfig.model) || currentProviderObj.models[0];

  const renderInputBox = (isCentered = false) => (
    <div
      style={{
        maxWidth: '720px',
        width: '100%',
        position: 'relative',
        background: '#ffffff',
        borderRadius: '30px',
        padding: '6px 10px 6px 10px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        border: '1px solid #e2e8f0',
        boxShadow: isCentered
          ? '0 8px 30px -4px rgba(0,0,0,0.06), 0 2px 6px -1px rgba(0,0,0,0.02)'
          : '0 4px 20px -2px rgba(0,0,0,0.05), 0 1px 3px rgba(0,0,0,0.02)',
        transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
      onFocusCapture={(e) => {
        e.currentTarget.style.borderColor = '#cbd5e1';
        e.currentTarget.style.boxShadow = isCentered
          ? '0 10px 32px -4px rgba(0,0,0,0.08), 0 0 0 2px rgba(226, 232, 240, 0.8)'
          : '0 6px 24px -2px rgba(0,0,0,0.06), 0 0 0 2px rgba(226, 232, 240, 0.8)';
      }}
      onBlurCapture={(e) => {
        e.currentTarget.style.borderColor = '#e2e8f0';
        e.currentTarget.style.boxShadow = isCentered
          ? '0 8px 30px -4px rgba(0,0,0,0.06), 0 2px 6px -1px rgba(0,0,0,0.02)'
          : '0 4px 20px -2px rgba(0,0,0,0.05), 0 1px 3px rgba(0,0,0,0.02)';
      }}
    >
      {/* Floating Card directly above the input container, matching its exact width */}
      {plusMenuOpen && (
        <div
          ref={plusMenuRef}
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 10px)',
            left: 0,
            right: 0,
            width: '100%',
            backgroundColor: '#ffffff',
            borderRadius: '20px',
            border: '1px solid #e5e7eb',
            boxShadow: '0 20px 40px -8px rgba(0,0,0,0.14), 0 4px 16px rgba(0,0,0,0.06)',
            padding: '8px',
            zIndex: 100,
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
            boxSizing: 'border-box'
          }}
        >
          {/* Action 1: Audit Open Risk */}
          <button
            type="button"
            onClick={() => {
              setPlusMenuOpen(false);
              handleSendMessage('Audit all my open positions, calculate current risk and missing stop losses.');
            }}
            style={{
              width: '100%',
              padding: '9px 12px',
              borderRadius: '12px',
              border: 'none',
              background: 'transparent',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'background-color 0.15s ease'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <div style={{
              width: '30px',
              height: '30px',
              borderRadius: '8px',
              backgroundColor: '#eff6ff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <Zap size={16} color="#2563eb" />
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', flex: 1, minWidth: 0, flexWrap: 'wrap' }}>
              <span style={{ fontSize: '13.5px', fontWeight: 600, color: '#111827', whiteSpace: 'nowrap' }}>Audit Open Risk</span>
              <span style={{ fontSize: '12.5px', color: '#6b7280', fontWeight: 400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Missing stop losses & portfolio risk</span>
            </div>
          </button>

          {/* Action 2: End-of-Day (EOD) Review */}
          <button
            type="button"
            onClick={() => {
              setPlusMenuOpen(false);
              handleSendMessage("Run an automated End-of-Day (EOD) Session Review for my latest trading day: analyze all trades taken, compute my discipline score, evaluate setup execution against my plan, detect any psychological mistakes or tilt, and give tomorrow's pre-bell action rule.");
            }}
            style={{
              width: '100%',
              padding: '9px 12px',
              borderRadius: '12px',
              border: 'none',
              background: 'transparent',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'background-color 0.15s ease'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <div style={{
              width: '30px',
              height: '30px',
              borderRadius: '8px',
              backgroundColor: '#f0fdf4',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <CalendarCheck size={16} color="#059669" />
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', flex: 1, minWidth: 0, flexWrap: 'wrap' }}>
              <span style={{ fontSize: '13.5px', fontWeight: 600, color: '#111827', whiteSpace: 'nowrap' }}>End-of-Day (EOD) Review</span>
              <span style={{ fontSize: '12.5px', color: '#6b7280', fontWeight: 400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Daily session debrief & discipline score</span>
            </div>
          </button>

          {/* Action 3: Weekly Report Card */}
          <button
            type="button"
            onClick={() => {
              setPlusMenuOpen(false);
              handleSendMessage('Generate my On-Demand Weekly Executive Report Card & ₹ Mistake Cost Audit. Grade my trading across the 4 pillars (Risk, Setups, Payoff, Discipline), show the exact rupee cost of my avoidable mistakes, and give my weekend drill before Monday open.');
            }}
            style={{
              width: '100%',
              padding: '9px 12px',
              borderRadius: '12px',
              border: 'none',
              background: 'transparent',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'background-color 0.15s ease'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <div style={{
              width: '30px',
              height: '30px',
              borderRadius: '8px',
              backgroundColor: '#fffbeb',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <Award size={16} color="#d97706" />
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', flex: 1, minWidth: 0, flexWrap: 'wrap' }}>
              <span style={{ fontSize: '13.5px', fontWeight: 600, color: '#111827', whiteSpace: 'nowrap' }}>Weekly Report Card</span>
              <span style={{ fontSize: '12.5px', color: '#6b7280', fontWeight: 400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Letter grade & ₹ mistake cost audit</span>
            </div>
          </button>

          {/* Action 4: Auto-Tag & Mistake Classifier */}
          <button
            type="button"
            onClick={() => {
              setPlusMenuOpen(false);
              handleSendMessage('Run the AI Trade Playbook & Mistake Classifier. Audit all my trades for behavioral mistakes like FOMO, Averaging Down, Panic Selling, and Random Exits. Show the classification breakdown, financial bleed, and recommended playbooks.');
            }}
            style={{
              width: '100%',
              padding: '9px 12px',
              borderRadius: '12px',
              border: 'none',
              background: 'transparent',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'background-color 0.15s ease'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <div style={{
              width: '30px',
              height: '30px',
              borderRadius: '8px',
              backgroundColor: '#f5f3ff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <Tag size={16} color="#7c3aed" />
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', flex: 1, minWidth: 0, flexWrap: 'wrap' }}>
              <span style={{ fontSize: '13.5px', fontWeight: 600, color: '#111827', whiteSpace: 'nowrap' }}>Auto-Tag & Mistake Classifier</span>
              <span style={{ fontSize: '12.5px', color: '#6b7280', fontWeight: 400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Audit FOMO, averaging down & playbooks</span>
            </div>
          </button>

          {/* Action 5: Paste Contract Note / Trades */}
          <button
            type="button"
            onClick={() => {
              setPlusMenuOpen(false);
              setInputValue('Bought 100 shares of TATASTEEL at 184.30 on 2026-08-29, SL 179\nSold 50 shares of RELIANCE at 2940 on 2026-08-29');
              if (textareaRef.current) textareaRef.current.focus();
            }}
            style={{
              width: '100%',
              padding: '9px 12px',
              borderRadius: '12px',
              border: 'none',
              background: 'transparent',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'background-color 0.15s ease'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <div style={{
              width: '30px',
              height: '30px',
              borderRadius: '8px',
              backgroundColor: '#f0fdf4',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <FileSpreadsheet size={16} color="#059669" />
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', flex: 1, minWidth: 0, flexWrap: 'wrap' }}>
              <span style={{ fontSize: '13.5px', fontWeight: 600, color: '#111827', whiteSpace: 'nowrap' }}>Paste Contract Note / Trades</span>
              <span style={{ fontSize: '12.5px', color: '#6b7280', fontWeight: 400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Parse clipboard text for 1-click import</span>
            </div>
          </button>

          {/* Action 6: Pre-Trade Risk Screener */}
          <button
            type="button"
            onClick={() => {
              setPlusMenuOpen(false);
              setIsPreTradeOpen(true);
            }}
            style={{
              width: '100%',
              padding: '9px 12px',
              borderRadius: '12px',
              border: 'none',
              background: 'transparent',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'background-color 0.15s ease'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <div style={{
              width: '30px',
              height: '30px',
              borderRadius: '8px',
              backgroundColor: '#eff6ff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <ShieldCheck size={16} color="#1d4ed8" />
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', flex: 1, minWidth: 0, flexWrap: 'wrap' }}>
              <span style={{ fontSize: '13.5px', fontWeight: 600, color: '#111827', whiteSpace: 'nowrap' }}>Pre-Trade Risk Screener</span>
              <span style={{ fontSize: '12.5px', color: '#6b7280', fontWeight: 400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Gatekeeper cockpit before entering trade</span>
            </div>
          </button>
        </div>
      )}

      {/* Left — "+" action button */}
      <button
        ref={plusBtnRef}
        onClick={() => setPlusMenuOpen(prev => !prev)}
        title="Foxy AI Actions"
        type="button"
        aria-expanded={plusMenuOpen}
        style={{
          width: '32px',
          height: '32px',
          borderRadius: '50%',
          border: plusMenuOpen ? '1px solid #d1d5db' : '1px solid #e5e7eb',
          background: plusMenuOpen ? '#e5e7eb' : '#f3f4f6',
          color: plusMenuOpen ? '#111827' : '#4b5563',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          transition: 'all 0.15s ease',
          fontSize: '18px',
          fontWeight: 400,
          lineHeight: 1,
          paddingBottom: '2px',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = '#e5e7eb';
          e.currentTarget.style.color = '#111827';
          e.currentTarget.style.borderColor = '#d1d5db';
        }}
        onMouseLeave={(e) => {
          if (!plusMenuOpen) {
            e.currentTarget.style.background = '#f3f4f6';
            e.currentTarget.style.color = '#4b5563';
            e.currentTarget.style.borderColor = '#e5e7eb';
          } else {
            e.currentTarget.style.background = '#e5e7eb';
            e.currentTarget.style.color = '#111827';
            e.currentTarget.style.borderColor = '#d1d5db';
          }
        }}
      >
        +
      </button>

      {/* Textarea */}
      <textarea
        ref={textareaRef}
        rows={1}
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Ask anything about your trades or market setups..."
        className="foxy-textarea"
        style={{
          flex: 1,
          border: 'none',
          outline: 'none',
          backgroundColor: 'transparent',
          fontSize: '14.5px',
          color: '#111827',
          resize: 'none',
          maxHeight: '160px',
          padding: '6px 4px',
          fontFamily: 'inherit',
          lineHeight: '1.5',
          caretColor: '#1d4ed8',
        }}
      />

      {/* Right — Send button */}
      <button
        type="button"
        onClick={() => handleSendMessage()}
        disabled={!inputValue.trim() || isLoading}
        aria-label="Send message"
        style={{
          width: '34px',
          height: '34px',
          borderRadius: '50%',
          border: 'none',
          background: inputValue.trim() && !isLoading
            ? '#2563eb'
            : '#f3f4f6',
          color: inputValue.trim() && !isLoading ? '#ffffff' : '#9ca3af',
          cursor: inputValue.trim() && !isLoading ? 'pointer' : 'default',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
          flexShrink: 0,
          boxShadow: inputValue.trim() && !isLoading
            ? '0 2px 10px rgba(37,99,235,0.38)'
            : 'none',
        }}
        onMouseEnter={(e) => {
          if (inputValue.trim() && !isLoading) {
            e.currentTarget.style.background = '#1d4ed8';
            e.currentTarget.style.transform = 'scale(1.05)';
            e.currentTarget.style.boxShadow = '0 4px 14px rgba(37,99,235,0.48)';
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
          if (inputValue.trim() && !isLoading) {
            e.currentTarget.style.background = '#2563eb';
            e.currentTarget.style.boxShadow = '0 2px 10px rgba(37,99,235,0.38)';
          }
        }}
      >
        {isLoading
          ? <span style={{ width: 13, height: 13, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />
          : <Send size={14} />
        }
      </button>
    </div>
  );

  return (
    <>
    <style>{`
      @keyframes spin { to { transform: rotate(360deg); } }
      @keyframes foxyPulse { 0%,100% { opacity:0.4; transform:scale(0.85); } 50% { opacity:1; transform:scale(1); } }
      .foxy-textarea::placeholder { color: #9ca3af; }
    `}</style>
    <div style={{
      display: 'flex',
      height: 'calc(100vh - 104px)',
      width: '100%',
      backgroundColor: '#ffffff',
      color: '#111827',
      fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* ─── LEFT SIDEBAR (COLLAPSIBLE LIKE CHATGPT) ─── */}
      <div style={{
        width: sidebarOpen ? '260px' : '52px',
        minWidth: sidebarOpen ? '260px' : '52px',
        backgroundColor: '#f9fafb',
        borderRight: '1px solid #f0f0f2',
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.22s cubic-bezier(0.16, 1, 0.3, 1), min-width 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
        overflow: 'hidden',
        zIndex: 20
      }}>
        {!sidebarOpen ? (
          /* COLLAPSED RAIL (52px wide, matches media_1790787429708.png & ChatGPT) */
          <div style={{
            width: '52px',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '14px 0 14px 0',
            boxSizing: 'border-box'
          }}>
            {/* 1. App Logo / Expand Sidebar button */}
            <button
              onClick={() => setSidebarOpen(true)}
              title="Open sidebar"
              aria-label="Open sidebar"
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background-color 0.15s ease',
                padding: 0
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <FoxTradeLogo size={22} />
            </button>

            {/* 2. New Chat Button */}
            <button
              onClick={createNewChat}
              title="New chat"
              aria-label="New chat"
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                border: 'none',
                background: 'none',
                color: '#374151',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginTop: '16px',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#f3f4f6';
                e.currentTarget.style.color = '#111827';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = '#374151';
              }}
            >
              <SquarePen size={19} />
            </button>

            {/* 3. Search Chats Button */}
            <button
              onClick={() => {
                setSidebarOpen(true);
                setIsSearchOpen(true);
              }}
              title="Search chats"
              aria-label="Search chats"
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                border: 'none',
                background: 'none',
                color: '#374151',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginTop: '12px',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#f3f4f6';
                e.currentTarget.style.color = '#111827';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = '#374151';
              }}
            >
              <Search size={19} />
            </button>

            {/* 4. Recent Chats Button */}
            <button
              onClick={() => setSidebarOpen(true)}
              title="Recent chats"
              aria-label="Recent chats"
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                border: 'none',
                background: 'none',
                color: '#374151',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginTop: '12px',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#f3f4f6';
                e.currentTarget.style.color = '#111827';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = '#374151';
              }}
            >
              <MessageSquare size={19} />
            </button>

            {/* Spacer */}
            <div style={{ flex: 1 }} />

            {/* 5. User Profile / Settings Avatar ("FO" Green Circle) */}
            <button
              onClick={() => setIsSettingsOpen(true)}
              title="AI Settings & Models"
              aria-label="AI Settings & Models"
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                border: 'none',
                backgroundColor: '#10b981',
                color: '#ffffff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '0.5px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
                transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                padding: 0
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.08)';
                e.currentTarget.style.boxShadow = '0 3px 8px rgba(16,185,129,0.35)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.12)';
              }}
            >
              FO
            </button>
          </div>
        ) : (
          /* EXPANDED SIDEBAR (260px wide) */
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            width: '260px',
            boxSizing: 'border-box'
          }}>
            {/* Sidebar Header: FoxTrade Logo + Foxy AI + Collapse Toggle */}
            <div style={{
              padding: '16px 14px 12px 14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: '1px solid #f0f0f2'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FoxTradeLogo size={22} />
                <span style={{ fontSize: '15px', fontWeight: 800, color: '#111827', letterSpacing: '-0.2px' }}>
                  Foxy AI
                </span>
              </div>

              <button
                onClick={() => setSidebarOpen(false)}
                title="Collapse sidebar"
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#6b7280',
                  cursor: 'pointer',
                  padding: '6px',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <PanelLeftClose size={16} />
              </button>
            </div>

            {/* + New Chat Pill Button & Search Toggle */}
            <div style={{ padding: '12px 12px 6px 12px', display: 'flex', gap: '6px', alignItems: 'center' }}>
              <button
                onClick={createNewChat}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: '10px',
                  border: '1px solid #e5e7eb',
                  backgroundColor: '#ffffff',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: '#111827',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#d1d5db';
                  e.currentTarget.style.backgroundColor = '#fafbfc';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#e5e7eb';
                  e.currentTarget.style.backgroundColor = '#ffffff';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Plus size={15} color="#111827" />
                  <span>New chat</span>
                </div>
                <span style={{ fontSize: '11px', color: '#9ca3af', fontWeight: 500 }}>⌘N</span>
              </button>

              <button
                onClick={() => {
                  setIsSearchOpen(prev => {
                    const next = !prev;
                    if (next) setTimeout(() => searchInputRef.current?.focus(), 50);
                    return next;
                  });
                }}
                title="Search chats"
                style={{
                  padding: '8px',
                  borderRadius: '10px',
                  border: '1px solid #e5e7eb',
                  backgroundColor: isSearchOpen ? '#f3f4f6' : '#ffffff',
                  color: '#4b5563',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
                onMouseLeave={(e) => {
                  if (!isSearchOpen) e.currentTarget.style.backgroundColor = '#ffffff';
                }}
              >
                <Search size={15} />
              </button>
            </div>

            {/* Search Input Bar (when toggled open) */}
            {isSearchOpen && (
              <div style={{ padding: '0 12px 6px 12px' }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '5px 8px',
                  borderRadius: '8px',
                  border: '1px solid #e5e7eb',
                  backgroundColor: '#ffffff'
                }}>
                  <Search size={13} color="#9ca3af" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search chats..."
                    style={{
                      border: 'none',
                      outline: 'none',
                      width: '100%',
                      fontSize: '12px',
                      color: '#111827',
                      backgroundColor: 'transparent'
                    }}
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#9ca3af', fontSize: '11px' }}
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Chat History List */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: '6px 8px',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px'
            }}>
              {(() => {
                const displayedChats = searchQuery.trim()
                  ? chats.filter(c => (c.title || '').toLowerCase().includes(searchQuery.toLowerCase()))
                  : chats;
                const pinnedChats = displayedChats.filter(c => c.isPinned);
                const recentChats = displayedChats.filter(c => !c.isPinned);

            const renderChatItem = (chat) => {
              const isActive = chat.id === activeChatId;
              const isHovered = hoveredChatId === chat.id;
              const isMenuOpen = menuOpenChatId === chat.id;
              const isEditing = editingChatId === chat.id;

              return (
                <div
                  key={chat.id}
                  onClick={() => {
                    if (!isEditing) selectChat(chat.id);
                  }}
                  style={{
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '7px 8px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    backgroundColor: isActive ? '#ececee' : (isHovered || isMenuOpen ? '#f3f4f6' : 'transparent'),
                    color: isActive ? '#111827' : '#4b5563',
                    fontSize: '13px',
                    fontWeight: isActive ? 600 : 500,
                    transition: 'background-color 0.12s ease',
                    minHeight: '36px'
                  }}
                  onMouseEnter={() => setHoveredChatId(chat.id)}
                  onMouseLeave={() => setHoveredChatId(null)}
                >
                  {/* Chat Title / Inline Rename */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    overflow: 'hidden',
                    flex: 1,
                    minWidth: 0,
                    paddingRight: '4px'
                  }}>
                    {chat.isPinned && (
                      <Pin
                        size={12}
                        color={isActive ? '#111827' : '#6b7280'}
                        style={{ transform: 'rotate(45deg)', flexShrink: 0 }}
                      />
                    )}
                    {isEditing ? (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          saveRenameChat(chat.id);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        style={{ width: '100%', margin: 0, padding: 0 }}
                      >
                        <input
                          type="text"
                          value={editingTitle}
                          autoFocus
                          onChange={(e) => setEditingTitle(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Escape') {
                              e.preventDefault();
                              setEditingChatId(null);
                            }
                          }}
                          onBlur={() => saveRenameChat(chat.id)}
                          style={{
                            width: '100%',
                            padding: '3px 6px',
                            fontSize: '12.5px',
                            fontWeight: 500,
                            borderRadius: '6px',
                            border: '1px solid #3b82f6',
                            outline: 'none',
                            backgroundColor: '#ffffff',
                            color: '#111827',
                            boxShadow: '0 0 0 2px rgba(59, 130, 246, 0.2)'
                          }}
                        />
                      </form>
                    ) : (
                      <span style={{
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        width: '100%'
                      }}>
                        {chat.title || 'Untitled chat'}
                      </span>
                    )}
                  </div>

                  {/* Fadeable Pin & 3-Dot Actions on Hover */}
                  {!isEditing && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '2px',
                        flexShrink: 0,
                        opacity: (isHovered || isMenuOpen) ? 1 : 0,
                        pointerEvents: (isHovered || isMenuOpen) ? 'auto' : 'none',
                        transition: 'opacity 0.15s ease'
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {/* Pin Toggle Button */}
                      <button
                        onClick={(e) => togglePinChat(e, chat.id)}
                        title={chat.isPinned ? "Unpin chat" : "Pin chat"}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: chat.isPinned ? '#111827' : '#9ca3af',
                          cursor: 'pointer',
                          padding: '3px 4px',
                          borderRadius: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'color 0.12s ease, background-color 0.12s ease'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.color = '#111827';
                          e.currentTarget.style.backgroundColor = '#e5e7eb';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color = chat.isPinned ? '#111827' : '#9ca3af';
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                      >
                        <Pin size={13} fill={chat.isPinned ? '#111827' : 'none'} style={{ transform: 'rotate(45deg)' }} />
                      </button>

                      {/* 3-Dot Menu Button */}
                      <button
                        data-chat-menu-btn="true"
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuOpenChatId(prev => prev === chat.id ? null : chat.id);
                        }}
                        title="More options"
                        style={{
                          background: isMenuOpen ? '#e5e7eb' : 'none',
                          border: 'none',
                          color: isMenuOpen ? '#111827' : '#9ca3af',
                          cursor: 'pointer',
                          padding: '3px 4px',
                          borderRadius: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'color 0.12s ease, background-color 0.12s ease'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.color = '#111827';
                          e.currentTarget.style.backgroundColor = '#e5e7eb';
                        }}
                        onMouseLeave={(e) => {
                          if (!isMenuOpen) {
                            e.currentTarget.style.color = '#9ca3af';
                            e.currentTarget.style.backgroundColor = 'transparent';
                          }
                        }}
                      >
                        <MoreHorizontal size={14} />
                      </button>
                    </div>
                  )}

                  {/* 3-Dot Dropdown Menu (Clean light theme matching FoxTrade) */}
                  {isMenuOpen && (
                    <div
                      ref={chatMenuRef}
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        position: 'absolute',
                        right: '6px',
                        top: '32px',
                        zIndex: 100,
                        width: '142px',
                        backgroundColor: '#ffffff',
                        borderRadius: '10px',
                        border: '1px solid #e5e7eb',
                        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.05)',
                        padding: '5px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '2px'
                      }}
                    >
                      {/* Rename */}
                      <button
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={(e) => startRenameChat(e, chat)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '9px',
                          width: '100%',
                          padding: '7px 10px',
                          background: 'none',
                          border: 'none',
                          borderRadius: '7px',
                          color: '#1f2937',
                          fontSize: '13px',
                          fontWeight: 500,
                          cursor: 'pointer',
                          textAlign: 'left',
                          transition: 'background-color 0.12s ease'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        <Pencil size={14} color="#4b5563" />
                        <span>Rename</span>
                      </button>

                      <div style={{ height: '1px', backgroundColor: '#f1f5f9', margin: '3px 4px' }} />

                      {/* Pin / Unpin */}
                      <button
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={(e) => {
                          e.stopPropagation();
                          togglePinChat(e, chat.id);
                          setMenuOpenChatId(null);
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '9px',
                          width: '100%',
                          padding: '7px 10px',
                          background: 'none',
                          border: 'none',
                          borderRadius: '7px',
                          color: '#1f2937',
                          fontSize: '13px',
                          fontWeight: 500,
                          cursor: 'pointer',
                          textAlign: 'left',
                          transition: 'background-color 0.12s ease'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        <Pin size={14} color="#4b5563" style={{ transform: 'rotate(45deg)' }} />
                        <span>{chat.isPinned ? 'Unpin chat' : 'Pin chat'}</span>
                      </button>

                      <div style={{ height: '1px', backgroundColor: '#f1f5f9', margin: '3px 4px' }} />

                      {/* Delete */}
                      <button
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuOpenChatId(null);
                          deleteChat(e, chat.id);
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '9px',
                          width: '100%',
                          padding: '7px 10px',
                          background: 'none',
                          border: 'none',
                          borderRadius: '7px',
                          color: '#dc2626',
                          fontSize: '13px',
                          fontWeight: 500,
                          cursor: 'pointer',
                          textAlign: 'left',
                          transition: 'background-color 0.12s ease'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#fef2f2'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        <Trash2 size={14} color="#dc2626" />
                        <span>Delete</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            };

            return (
              <>
                {/* Pinned Section */}
                {pinnedChats.length > 0 && (
                  <div>
                    <div
                      onClick={() => setPinnedCollapsed(prev => !prev)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '6px 8px 4px 8px',
                        cursor: 'pointer',
                        userSelect: 'none',
                        borderRadius: '6px',
                        transition: 'background-color 0.12s ease'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <span style={{ fontSize: '11px', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        Pinned ({pinnedChats.length})
                      </span>
                      {pinnedCollapsed ? <ChevronRight size={13} color="#9ca3af" /> : <ChevronDown size={13} color="#9ca3af" />}
                    </div>
                    {!pinnedCollapsed && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '2px' }}>
                        {pinnedChats.map(chat => renderChatItem(chat))}
                      </div>
                    )}
                  </div>
                )}

                {/* Recent Section */}
                <div>
                  <div
                    onClick={() => setRecentCollapsed(prev => !prev)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '6px 8px 4px 8px',
                      cursor: 'pointer',
                      userSelect: 'none',
                      borderRadius: '6px',
                      marginTop: pinnedChats.length > 0 ? '6px' : '0',
                      transition: 'background-color 0.12s ease'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Recent ({recentChats.length})
                    </span>
                    {recentCollapsed ? <ChevronRight size={13} color="#9ca3af" /> : <ChevronDown size={13} color="#9ca3af" />}
                  </div>
                  {!recentCollapsed && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '2px' }}>
                      {recentChats.map(chat => renderChatItem(chat))}
                    </div>
                  )}
                </div>
              </>
            );
          })()}
        </div>

        {/* Sidebar Footer: Model Status & Key Configuration Trigger */}
        <div style={{
          padding: '12px',
          borderTop: '1px solid #f0f0f2',
          backgroundColor: '#fafbfc'
        }}>
          <button
            onClick={() => setIsSettingsOpen(true)}
            style={{
              width: '100%',
              padding: '8px 10px',
              borderRadius: '8px',
              border: '1px solid #e5e7eb',
              backgroundColor: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                backgroundColor: foxyConfig.apiKey ? '#10b981' : '#f59e0b'
              }} />
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#111827' }}>
                  {currentModelObj?.name?.split(' ')[0] || 'Gemini'}
                </div>
                <div style={{ fontSize: '10px', color: '#6b7280' }}>
                  {foxyConfig.apiKey ? 'Connected' : 'Free Local Mode'}
                </div>
              </div>
            </div>

            <Settings size={14} color="#6b7280" />
          </button>
        </div>
          </div>
        )}
      </div>

      {/* ─── MAIN CHAT AREA (WHITE MINIMALIST CHATGPT STYLE) ─── */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        backgroundColor: '#ffffff',
        position: 'relative',
        overflow: 'hidden'
      }}>



        {/* Message Container */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '24px 20px 120px 20px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center'
        }}>
          {messages.length === 0 ? (
            /* ─── EMPTY STATE: CENTERED CHAT BOX & BALANCED PILLS ─── */
            <div style={{
              maxWidth: '680px',
              width: '100%',
              margin: 'auto 0',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '20px',
              padding: '20px 0'
            }}>
              {/* FoxTrade Emblem */}
              <div style={{
                width: '52px',
                height: '52px',
                borderRadius: '16px',
                backgroundColor: '#ffffff',
                border: '1px solid #e5e7eb',
                boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <FoxTradeLogo size={30} />
              </div>

              {/* Clean Heading */}
              <h1 style={{
                fontSize: '28px',
                fontWeight: 700,
                color: '#111827',
                margin: '0 0 6px 0',
                letterSpacing: '-0.5px'
              }}>
                Where should we begin?
              </h1>

              {/* 4 Perfectly Balanced Quick Starter Cards (2x2 Grid) */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '10px',
                width: '100%',
                marginTop: '4px'
              }}>
                {QUICK_STARTERS.map((starter, idx) => {
                  const Icon = starter.icon;
                  return (
                    <button
                      key={idx}
                      onClick={() => handleSendMessage(starter.prompt)}
                      style={{
                        padding: '12px 14px',
                        borderRadius: '12px',
                        border: '1px solid #e5e7eb',
                        backgroundColor: '#ffffff',
                        textAlign: 'left',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        transition: 'all 0.15s ease',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = '#111827';
                        e.currentTarget.style.backgroundColor = '#fafbfc';
                        e.currentTarget.style.transform = 'translateY(-1px)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = '#e5e7eb';
                        e.currentTarget.style.backgroundColor = '#ffffff';
                        e.currentTarget.style.transform = 'none';
                      }}
                    >
                      <div style={{
                        padding: '6px',
                        borderRadius: '8px',
                        backgroundColor: '#f3f4f6',
                        color: '#111827',
                        display: 'flex'
                      }}>
                        <Icon size={14} />
                      </div>
                      <span style={{ fontSize: '13px', fontWeight: 500, color: '#374151' }}>
                        {starter.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            /* ─── ACTIVE CHAT CONVERSATION FLOW ─── */
            <div style={{
              maxWidth: '740px',
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              gap: '24px'
            }}>
              {messages.map((msg, idx) => {
                const isUser = msg.role === 'user';

                // User query message — aligned strictly to the RIGHT
                if (isUser) {
                  return (
                    <div
                      key={msg.id || idx}
                      style={{
                        display: 'flex',
                        justifyContent: 'flex-end',
                        width: '100%',
                        marginBottom: '4px'
                      }}
                    >
                      <div
                        style={{
                          backgroundColor: '#0e3a6c', // Sleek ChatGPT dark navy bubble matching screenshot
                          color: '#ffffff',
                          padding: '10px 18px',
                          borderRadius: '22px',
                          fontSize: '14px',
                          lineHeight: '1.5',
                          maxWidth: '78%',
                          wordBreak: 'break-word',
                          whiteSpace: 'pre-wrap',
                          boxShadow: '0 2px 8px rgba(14, 58, 108, 0.15)'
                        }}
                      >
                        {msg.content}
                      </div>
                    </div>
                  );
                }

                // Foxy AI response — aligned strictly to the LEFT
                return (
                  <div
                    key={msg.id || idx}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '12px',
                      alignSelf: 'flex-start',
                      width: '100%',
                      marginBottom: '8px'
                    }}
                  >
                    <div style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '8px',
                      backgroundColor: '#ffffff',
                      border: '1px solid #e5e7eb',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      marginTop: '2px'
                    }}>
                      <FoxTradeLogo size={16} />
                    </div>

                    <div style={{
                      flex: 1,
                      color: '#111827',
                      fontSize: '14px',
                      lineHeight: '1.6',
                      position: 'relative'
                    }}>
                      <div>
                        <FoxyResponseRenderer content={msg.content} onImportTrades={handleImportTrades} />
                      </div>

                      <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button
                          onClick={() => copyToClipboard(msg.content, idx)}
                          title="Copy response"
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#9ca3af',
                            cursor: 'pointer',
                            padding: '4px',
                            borderRadius: '4px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '11px'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.color = '#111827'}
                          onMouseLeave={(e) => e.currentTarget.style.color = '#9ca3af'}
                        >
                          {copiedIndex === idx ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                          <span>{copiedIndex === idx ? 'Copied' : 'Copy'}</span>
                        </button>

                        <button
                          onClick={() => handleSaveToJournal(msg.content, idx)}
                          title="Save this analysis as a journal note"
                          style={{
                            background: 'none',
                            border: 'none',
                            color: savedJournalIndex === idx ? '#10b981' : '#9ca3af',
                            cursor: 'pointer',
                            padding: '4px',
                            borderRadius: '4px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '11px'
                          }}
                          onMouseEnter={(e) => {
                            if (savedJournalIndex !== idx) e.currentTarget.style.color = '#111827';
                          }}
                          onMouseLeave={(e) => {
                            if (savedJournalIndex !== idx) e.currentTarget.style.color = '#9ca3af';
                          }}
                        >
                          {savedJournalIndex === idx ? <BookmarkCheck size={12} color="#10b981" /> : <CalendarCheck size={12} />}
                          <span>{savedJournalIndex === idx ? 'Saved to Notes' : 'Save to Journal'}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Typing / Loading indicator */}
              {isLoading && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', alignSelf: 'flex-start' }}>
                  <div style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '8px',
                    backgroundColor: '#ffffff',
                    border: '1px solid #e5e7eb',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <FoxTradeLogo size={16} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 0' }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#9ca3af', animation: 'foxyPulse 1.2s ease-in-out infinite' }} />
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#9ca3af', animation: 'foxyPulse 1.2s ease-in-out infinite 0.22s' }} />
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#9ca3af', animation: 'foxyPulse 1.2s ease-in-out infinite 0.44s' }} />
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} style={{ height: '100px' }} />
            </div>
          )}
        </div>

        {/* ─── FLOATING INPUT BAR (always visible at bottom, truly floating) ─── */}
        <div style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '0 20px 18px 20px',
          background: 'linear-gradient(to top, rgba(255,255,255,1) 60%, rgba(255,255,255,0) 100%)',
          pointerEvents: 'none',
          zIndex: 10,
        }}>
          <div style={{ pointerEvents: 'all', width: '100%', maxWidth: '740px' }}>
            {renderInputBox(false)}
          </div>
        </div>
      </div>

      {/* ─── SETTINGS MODAL (BYOK) ─── */}
      <FoxySettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onConfigSaved={(newCfg) => setFoxyConfig(newCfg)}
      />

      {/* ─── PRE-TRADE SCREENER PANEL ─── */}
      <FoxyPreTradePanel
        isOpen={isPreTradeOpen}
        onClose={() => setIsPreTradeOpen(false)}
        trades={trades}
        portfolioCapital={metrics?.portfolioCapital || portfolioCapital || 0}
      />
    </div>
    </>
  );
}
