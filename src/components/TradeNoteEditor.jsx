import React, { useState, useRef, useEffect } from 'react';
import { 
  FileText, Smile, Meh, Frown, Angry, Sparkles, 
  Download, Mic, Globe, AtSign, Bold, Italic, 
  Underline, Strikethrough, List, ListOrdered, 
  AlignLeft, AlignCenter, AlignRight, Quote, 
  Code, Link2, Image as ImageIcon, Video, 
  Subscript, Superscript, Table, RotateCcw, 
  X, Plus, Check, Type
} from 'lucide-react';
import SymbolLogo from './SymbolLogo';
import ModernDropdown from './ModernDropdown';

export default function TradeNoteEditor({ 
  trade, 
  symbol, 
  onSave 
}) {
  const [title, setTitle] = useState('');
  const [tags, setTags] = useState([]);
  const [tagInput, setTagInput] = useState('');
  const [mood, setMood] = useState('frustrated'); // 'great' | 'good' | 'neutral' | 'frustrated' | 'terrible'
  const [isRecording, setIsRecording] = useState(false);
  const [formatBlock, setFormatBlock] = useState('Normal');
  const editorRef = useRef(null);

  // Load existing trade notes
  useEffect(() => {
    if (trade) {
      setTitle(trade.noteTitle || (trade.name ? `${trade.name} Trade #${trade.tradeNo || ''} Analysis` : ''));
      if (Array.isArray(trade.tags)) {
        setTags(trade.tags);
      } else if (typeof trade.tags === 'string' && trade.tags) {
        setTags(trade.tags.split(',').map(t => t.trim()).filter(Boolean));
      }
      setMood(trade.mood || 'frustrated');
      if (editorRef.current) {
        editorRef.current.innerHTML = trade.notes || '';
      }
    }
  }, [trade?.id, trade?.tradeNo]);

  // Auto-save on changes
  const saveTimeoutRef = useRef(null);
  const triggerSave = (newTitle, newTags, newMood, newContent) => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      if (onSave && trade) {
        onSave(trade.id, {
          noteTitle: newTitle !== undefined ? newTitle : title,
          tags: newTags !== undefined ? newTags : tags,
          mood: newMood !== undefined ? newMood : mood,
          notes: newContent !== undefined ? newContent : (editorRef.current?.innerHTML || '')
        });
      }
    }, 400);
  };

  const handleTitleChange = (e) => {
    const val = e.target.value.slice(0, 80);
    setTitle(val);
    triggerSave(val, undefined, undefined, undefined);
  };

  const handleAddTag = (e) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault();
      if (tags.length < 8 && !tags.includes(tagInput.trim())) {
        const nextTags = [...tags, tagInput.trim()];
        setTags(nextTags);
        setTagInput('');
        triggerSave(undefined, nextTags, undefined, undefined);
      }
    }
  };

  const handleRemoveTag = (indexToRemove) => {
    const nextTags = tags.filter((_, idx) => idx !== indexToRemove);
    setTags(nextTags);
    triggerSave(undefined, nextTags, undefined, undefined);
  };

  const handleMoodSelect = (selectedMood) => {
    setMood(selectedMood);
    triggerSave(undefined, undefined, selectedMood, undefined);
  };

  const handleEditorInput = () => {
    const html = editorRef.current ? editorRef.current.innerHTML : '';
    triggerSave(undefined, undefined, undefined, html);
  };

  // Formatting commands
  const execCmd = (command, value = null) => {
    document.execCommand(command, false, value);
    if (editorRef.current) {
      editorRef.current.focus();
      handleEditorInput();
    }
  };

  const handleFormatChange = (valOrEvent) => {
    const val = (valOrEvent && valOrEvent.target) ? valOrEvent.target.value : valOrEvent;
    setFormatBlock(val);
    if (val === 'Normal') execCmd('formatBlock', '<p>');
    else if (val === 'H1') execCmd('formatBlock', '<h1>');
    else if (val === 'H2') execCmd('formatBlock', '<h2>');
    else if (val === 'H3') execCmd('formatBlock', '<h3>');
    else if (val === 'Quote') execCmd('formatBlock', '<blockquote>');
    else if (val === 'Code') execCmd('formatBlock', '<pre>');
  };

  // Export note as text
  const handleExport = () => {
    const textContent = editorRef.current ? editorRef.current.innerText : '';
    const fileContent = `Trade #${trade?.tradeNo || ''} - ${symbol || ''}\nDate: ${formattedDate}\nTitle: ${title}\nTags: ${tags.join(', ')}\nMood: ${mood}\n\n${textContent}`;
    const blob = new Blob([fileContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Trade_${trade?.tradeNo || ''}_${symbol || 'Note'}.txt`;
    link.click();
  };

  // Speech-to-text toggle
  const handleSpeechToggle = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('Speech recognition is not supported in this browser.');
      return;
    }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!isRecording) {
      try {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'en-IN';
        recognition.onstart = () => setIsRecording(true);
        recognition.onresult = (event) => {
          const transcript = event.results[0][0].transcript;
          execCmd('insertText', transcript + ' ');
        };
        recognition.onerror = () => setIsRecording(false);
        recognition.onend = () => setIsRecording(false);
        recognition.start();
      } catch (err) {
        setIsRecording(false);
      }
    } else {
      setIsRecording(false);
    }
  };

  // Mention trade handler
  const handleInsertTradeRef = () => {
    execCmd('insertText', `@trade${trade?.tradeNo || ''} `);
  };

  // Formatted date string
  const formattedDate = React.useMemo(() => {
    if (!trade?.date) return new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    try {
      const parts = String(trade.date).split('T')[0].split('-');
      let d;
      if (parts.length === 3) {
        d = parts[0].length === 4 ? new Date(parts[0], parts[1] - 1, parts[2]) : new Date(parts[2], parts[1] - 1, parts[0]);
      } else {
        d = new Date(trade.date);
      }
      return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    } catch {
      return String(trade.date);
    }
  }, [trade?.date]);

  return (
    <div style={{
      backgroundColor: 'var(--bg-card, #ffffff)',
      border: '1px solid var(--border-color, #e5e7eb)',
      borderRadius: '16px',
      boxShadow: 'var(--shadow-card, 0 1px 3px rgba(0,0,0,0.05))',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }}>
      {/* ── 1. Top Header ──────────────────────────────────────────────────── */}
      <div style={{
        padding: '16px 22px',
        borderBottom: '1px solid var(--border-color, #f3f4f6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FileText size={16} color="#6b7280" />
          <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-primary, #111827)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            NOTES
          </span>
        </div>
        <span style={{ fontSize: '12px', fontWeight: 600, color: '#9ca3af' }}>
          Trade #{trade?.tradeNo || '—'}
        </span>
      </div>

      {/* ── 2. Add Note & Date Subheader ───────────────────────────────────── */}
      <div style={{ padding: '22px 24px 0 24px' }}>
        <h2 style={{ margin: '0 0 4px 0', fontSize: '18px', fontWeight: 700, color: 'var(--text-primary, #111827)' }}>
          Add Note
        </h2>
        <div style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '20px' }}>
          {formattedDate}
        </div>

        {/* TITLE* Field */}
        <div style={{ marginBottom: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ fontSize: '11px', fontWeight: 800, color: '#6b7280', letterSpacing: '0.05em' }}>
              TITLE*
            </span>
            <span style={{ fontSize: '11px', color: '#9ca3af' }}>
              {title.length}/80
            </span>
          </div>
          <input
            type="text"
            placeholder="Enter note title..."
            value={title}
            onChange={handleTitleChange}
            style={{
              width: '100%',
              padding: '10px 14px',
              borderRadius: '10px',
              border: '1px solid var(--border-color, #e5e7eb)',
              backgroundColor: 'var(--bg-surface, #ffffff)',
              fontSize: '13px',
              color: 'var(--text-primary, #111827)',
              outline: 'none',
              transition: 'border-color 0.15s ease'
            }}
          />
        </div>

        {/* TRADE NOTES: Pill */}
        <div style={{ marginBottom: '18px' }}>
          <div style={{ fontSize: '11px', fontWeight: 800, color: '#6b7280', letterSpacing: '0.05em', marginBottom: '6px' }}>
            TRADE NOTES:
          </div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '5px 12px', borderRadius: '20px', border: '1px solid #d1fae5', backgroundColor: '#ecfdf5' }}>
            <SymbolLogo symbol={symbol || trade?.name} size={16} />
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#047857' }}>
              Trade #{trade?.tradeNo || '—'}
            </span>
          </div>
        </div>

        {/* TAGS: Field */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ fontSize: '11px', fontWeight: 800, color: '#6b7280', letterSpacing: '0.05em' }}>
              TAGS:
            </span>
            <span style={{ fontSize: '11px', color: '#9ca3af' }}>
              {tags.length}/8
            </span>
          </div>

          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 12px',
            borderRadius: '10px',
            border: '1px solid var(--border-color, #e5e7eb)',
            backgroundColor: 'var(--bg-surface, #ffffff)'
          }}>
            {tags.map((tag, idx) => (
              <span
                key={idx}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '3px 8px',
                  borderRadius: '6px',
                  backgroundColor: '#f3f4f6',
                  fontSize: '11px',
                  fontWeight: 600,
                  color: '#374151'
                }}
              >
                #{tag}
                <button
                  onClick={() => handleRemoveTag(idx)}
                  style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}
                >
                  <X size={11} />
                </button>
              </span>
            ))}

            {tags.length < 8 && (
              <input
                type="text"
                placeholder={tags.length === 0 ? "Type tag and press Enter..." : "Add tag..."}
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleAddTag}
                style={{
                  flex: 1,
                  minWidth: '120px',
                  border: 'none',
                  outline: 'none',
                  fontSize: '12px',
                  color: 'var(--text-primary, #111827)',
                  backgroundColor: 'transparent'
                }}
              />
            )}
          </div>
        </div>

        {/* ── 3. Mood Toolbar & Action Buttons ─────────────────────────────── */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 16px',
          borderRadius: '12px',
          backgroundColor: 'var(--bg-primary, #f9fafb)',
          border: '1px solid var(--border-color, #f3f4f6)',
          marginBottom: '16px'
        }}>
          {/* Mood 5-Level Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={() => handleMoodSelect('great')}
              title="Euphoric / Excellent"
              style={{
                background: 'none',
                border: mood === 'great' ? '2px solid #10b981' : '1px solid transparent',
                borderRadius: '50%',
                padding: '3px',
                cursor: 'pointer',
                fontSize: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: mood === 'great' ? '#ecfdf5' : 'transparent',
                color: mood === 'great' ? '#10b981' : 'var(--text-muted, #9ca3af)',
                transition: 'all 0.12s ease'
              }}
            >
              <Smile size={16} />
            </button>
            <button
              onClick={() => handleMoodSelect('good')}
              title="Confident / Good"
              style={{
                background: 'none',
                border: mood === 'good' ? '2px solid #10b981' : '1px solid transparent',
                borderRadius: '50%',
                padding: '3px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: mood === 'good' ? '#ecfdf5' : 'transparent',
                color: mood === 'good' ? '#10b981' : 'var(--text-muted, #9ca3af)',
                transition: 'all 0.12s ease'
              }}
            >
              <Smile size={16} />
            </button>
            <button
              onClick={() => handleMoodSelect('neutral')}
              title="Neutral / Calm"
              style={{
                background: 'none',
                border: mood === 'neutral' ? '2px solid #6b7280' : '1px solid transparent',
                borderRadius: '50%',
                padding: '3px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: mood === 'neutral' ? '#f3f4f6' : 'transparent',
                color: mood === 'neutral' ? '#6b7280' : 'var(--text-muted, #9ca3af)',
                transition: 'all 0.12s ease'
              }}
            >
              <Meh size={16} />
            </button>
            <button
              onClick={() => handleMoodSelect('frustrated')}
              title="Frustrated / Bad"
              style={{
                background: 'none',
                border: mood === 'frustrated' ? '2px solid #f97316' : '1px solid transparent',
                borderRadius: '50%',
                padding: '3px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: mood === 'frustrated' ? '#fff7ed' : 'transparent',
                color: mood === 'frustrated' ? '#f97316' : 'var(--text-muted, #9ca3af)',
                transition: 'all 0.12s ease'
              }}
            >
              <Frown size={16} />
            </button>
            <button
              onClick={() => handleMoodSelect('terrible')}
              title="Angry / Terrible"
              style={{
                background: 'none',
                border: mood === 'terrible' ? '2px solid #ef4444' : '1px solid transparent',
                borderRadius: '50%',
                padding: '3px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: mood === 'terrible' ? '#fef2f2' : 'transparent',
                color: mood === 'terrible' ? '#ef4444' : 'var(--text-muted, #9ca3af)',
                transition: 'all 0.12s ease'
              }}
            >
              <Angry size={16} />
            </button>
          </div>

          {/* Right Action Icons (Export & Voice Dictation) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={handleExport}
              title="Export Note (.txt)"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 10px',
                borderRadius: '6px',
                border: '1px solid #e5e7eb',
                backgroundColor: '#ffffff',
                fontSize: '11px',
                fontWeight: 600,
                color: '#374151',
                cursor: 'pointer',
                transition: 'background-color 0.12s ease'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ffffff'}
            >
              <Download size={12} color="#6b7280" />
              <span>Export</span>
            </button>

            <button
              onClick={handleSpeechToggle}
              title={isRecording ? "Listening... click to stop" : "Speech-to-text (Dictate note)"}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 10px',
                borderRadius: '6px',
                border: '1px solid ' + (isRecording ? '#ef4444' : '#e5e7eb'),
                backgroundColor: isRecording ? '#fef2f2' : '#ffffff',
                color: isRecording ? '#dc2626' : '#374151',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.12s ease'
              }}
            >
              <Mic size={12} color={isRecording ? '#dc2626' : '#6b7280'} />
              <span>{isRecording ? 'Listening...' : 'Voice'}</span>
            </button>
          </div>
        </div>

        {/* ── 4. Rich Text Formatting Toolbar ──────────────────────────────── */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '6px',
          padding: '8px 12px',
          borderRadius: '10px',
          border: '1px solid var(--border-color, #e5e7eb)',
          backgroundColor: 'var(--bg-surface, #ffffff)',
          marginBottom: '14px'
        }}>
          {/* Format Dropdown - Modernized */}
          <div style={{ marginRight: '6px' }}>
            <ModernDropdown
              value={formatBlock}
              options={[
                { value: 'Normal', label: 'Normal' },
                { value: 'H1', label: 'Heading 1' },
                { value: 'H2', label: 'Heading 2' },
                { value: 'H3', label: 'Heading 3' },
                { value: 'Quote', label: 'Quote' },
                { value: 'Code', label: 'Code' }
              ]}
              variant="table"
              width="95px"
              onChange={(val) => handleFormatChange(val)}
            />
          </div>

          {/* Bold */}
          <button
            onClick={() => execCmd('bold')}
            title="Bold (Ctrl+B)"
            style={{ padding: '4px 6px', borderRadius: '4px', border: 'none', background: 'none', cursor: 'pointer', color: '#4b5563', fontWeight: 800 }}
          >
            B
          </button>

          {/* Italic */}
          <button
            onClick={() => execCmd('italic')}
            title="Italic (Ctrl+I)"
            style={{ padding: '4px 6px', borderRadius: '4px', border: 'none', background: 'none', cursor: 'pointer', color: '#4b5563', fontStyle: 'italic' }}
          >
            I
          </button>

          {/* Underline */}
          <button
            onClick={() => execCmd('underline')}
            title="Underline (Ctrl+U)"
            style={{ padding: '4px 6px', borderRadius: '4px', border: 'none', background: 'none', cursor: 'pointer', color: '#4b5563', textDecoration: 'underline' }}
          >
            U
          </button>

          {/* Strikethrough */}
          <button
            onClick={() => execCmd('strikeThrough')}
            title="Strikethrough"
            style={{ padding: '4px 6px', borderRadius: '4px', border: 'none', background: 'none', cursor: 'pointer', color: '#4b5563', textDecoration: 'line-through' }}
          >
            S
          </button>

          <div style={{ width: '1px', height: '16px', backgroundColor: '#e5e7eb', margin: '0 4px' }} />

          {/* Numbered List */}
          <button
            onClick={() => execCmd('insertOrderedList')}
            title="Numbered List"
            style={{ padding: '4px 6px', borderRadius: '4px', border: 'none', background: 'none', cursor: 'pointer', color: '#4b5563' }}
          >
            <ListOrdered size={14} />
          </button>

          {/* Bullet List */}
          <button
            onClick={() => execCmd('insertUnorderedList')}
            title="Bullet List"
            style={{ padding: '4px 6px', borderRadius: '4px', border: 'none', background: 'none', cursor: 'pointer', color: '#4b5563' }}
          >
            <List size={14} />
          </button>

          {/* Subscript */}
          <button
            onClick={() => execCmd('subscript')}
            title="Subscript"
            style={{ padding: '4px 6px', borderRadius: '4px', border: 'none', background: 'none', cursor: 'pointer', color: '#4b5563', fontSize: '11px', fontWeight: 700 }}
          >
            x₂
          </button>

          {/* Superscript */}
          <button
            onClick={() => execCmd('superscript')}
            title="Superscript"
            style={{ padding: '4px 6px', borderRadius: '4px', border: 'none', background: 'none', cursor: 'pointer', color: '#4b5563', fontSize: '11px', fontWeight: 700 }}
          >
            x²
          </button>

          {/* Indent Decrease */}
          <button
            onClick={() => execCmd('outdent')}
            title="Decrease Indent"
            style={{ padding: '4px 6px', borderRadius: '4px', border: 'none', background: 'none', cursor: 'pointer', color: '#4b5563' }}
          >
            ⇤
          </button>

          {/* Indent Increase */}
          <button
            onClick={() => execCmd('indent')}
            title="Increase Indent"
            style={{ padding: '4px 6px', borderRadius: '4px', border: 'none', background: 'none', cursor: 'pointer', color: '#4b5563' }}
          >
            ⇥
          </button>

          <div style={{ width: '1px', height: '16px', backgroundColor: '#e5e7eb', margin: '0 4px' }} />

          {/* Align Left */}
          <button
            onClick={() => execCmd('justifyLeft')}
            title="Align Left"
            style={{ padding: '4px 6px', borderRadius: '4px', border: 'none', background: 'none', cursor: 'pointer', color: '#4b5563' }}
          >
            <AlignLeft size={14} />
          </button>

          {/* Align Center */}
          <button
            onClick={() => execCmd('justifyCenter')}
            title="Align Center"
            style={{ padding: '4px 6px', borderRadius: '4px', border: 'none', background: 'none', cursor: 'pointer', color: '#4b5563' }}
          >
            <AlignCenter size={14} />
          </button>

          {/* Quote Block */}
          <button
            onClick={() => execCmd('formatBlock', '<blockquote>')}
            title="Quote"
            style={{ padding: '4px 6px', borderRadius: '4px', border: 'none', background: 'none', cursor: 'pointer', color: '#4b5563' }}
          >
            <Quote size={14} />
          </button>

          {/* Code Block */}
          <button
            onClick={() => execCmd('formatBlock', '<pre>')}
            title="Code Block"
            style={{ padding: '4px 6px', borderRadius: '4px', border: 'none', background: 'none', cursor: 'pointer', color: '#4b5563' }}
          >
            <Code size={14} />
          </button>

          {/* Link */}
          <button
            onClick={() => {
              const url = prompt('Enter link URL:');
              if (url) execCmd('createLink', url);
            }}
            title="Insert Link"
            style={{ padding: '4px 6px', borderRadius: '4px', border: 'none', background: 'none', cursor: 'pointer', color: '#4b5563' }}
          >
            <Link2 size={14} />
          </button>

          {/* Clear Format */}
          <button
            onClick={() => execCmd('removeFormat')}
            title="Clear Formatting"
            style={{ padding: '4px 6px', borderRadius: '4px', border: 'none', background: 'none', cursor: 'pointer', color: '#4b5563', fontSize: '11px', fontWeight: 700 }}
          >
            Tx
          </button>
        </div>

        {/* ── 5. Rich Text Content Area ────────────────────────────────────── */}
        <div
          ref={editorRef}
          contentEditable
          onInput={handleEditorInput}
          data-placeholder="Write down your thoughts..."
          style={{
            minHeight: '220px',
            maxHeight: '400px',
            overflowY: 'auto',
            padding: '12px 14px',
            borderRadius: '12px',
            border: '1px solid var(--border-color, #e5e7eb)',
            backgroundColor: 'var(--bg-surface, #ffffff)',
            fontSize: '13.5px',
            lineHeight: 1.6,
            color: 'var(--text-primary, #111827)',
            outline: 'none',
            fontFamily: 'inherit'
          }}
        />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0 16px 0' }}>
          <span style={{ fontSize: '11px', color: '#9ca3af' }}>
            Auto-saved to trade journal
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#10b981', fontSize: '11px', fontWeight: 600 }}>
            <Check size={12} strokeWidth={3} />
            <span>Saved</span>
          </div>
        </div>

      </div>
    </div>
  );
}
