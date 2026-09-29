import React, { useState } from 'react';
import { Pencil, Plus, Calendar, Tag, Trash2 } from 'lucide-react';

export default function JournalNotesInlineView({ trades = [] }) {
  const [quickNote, setQuickNote] = useState('');
  const [notesList, setNotesList] = useState(() => {
    try {
      const saved = localStorage.getItem('tradeontip_quick_notes');
      return saved ? JSON.parse(saved) : [
        { id: 1, date: '29 Aug 2026', title: 'Weekly Review', content: 'Followed discipline on stop-loss rules. Cut losing trades immediately without hesitation.', tag: 'Discipline' },
        { id: 2, date: '24 Aug 2026', title: 'Reliance VWAP Bounce Execution', content: 'Clean pullback to VWAP with heavy volume confirmation. Trailed SL according to plan.', tag: 'Trade Review' }
      ];
    } catch {
      return [];
    }
  });

  const handleAddNote = () => {
    if (!quickNote.trim()) return;
    const newNote = {
      id: Date.now(),
      date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      title: 'Trading Reflection',
      content: quickNote.trim(),
      tag: 'Journal'
    };
    const updated = [newNote, ...notesList];
    setNotesList(updated);
    setQuickNote('');
    localStorage.setItem('tradeontip_quick_notes', JSON.stringify(updated));
  };

  const handleDeleteNote = (id) => {
    const updated = notesList.filter(n => n.id !== id);
    setNotesList(updated);
    localStorage.setItem('tradeontip_quick_notes', JSON.stringify(updated));
  };

  return (
    <div style={{ padding: '0 24px 40px 24px', maxWidth: '900px', margin: '0 auto' }}>
      
      {/* Add note input card */}
      <div style={{
        backgroundColor: 'var(--bg-card, #ffffff)',
        border: '1px solid var(--border-color, #e5e7eb)',
        borderRadius: '16px',
        padding: '16px',
        marginBottom: '24px',
        boxShadow: 'var(--shadow-card, 0 1px 3px rgba(0,0,0,0.05))'
      }}>
        <textarea
          value={quickNote}
          onChange={(e) => setQuickNote(e.target.value)}
          placeholder="Write your daily trading notes, execution reflections, psychology logs..."
          rows={3}
          style={{
            width: '100%',
            border: 'none',
            outline: 'none',
            fontSize: '13px',
            fontFamily: 'inherit',
            resize: 'vertical',
            backgroundColor: 'transparent',
            color: 'var(--text-primary, #111827)'
          }}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
          <button
            onClick={handleAddNote}
            disabled={!quickNote.trim()}
            style={{
              padding: '6px 16px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: '#111827',
              color: '#ffffff',
              fontSize: '12px',
              fontWeight: 700,
              cursor: quickNote.trim() ? 'pointer' : 'not-allowed',
              opacity: quickNote.trim() ? 1 : 0.5
            }}
          >
            Save Note
          </button>
        </div>
      </div>

      {/* List of notes */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {notesList.map((note) => (
          <div
            key={note.id}
            style={{
              backgroundColor: 'var(--bg-card, #ffffff)',
              border: '1px solid var(--border-color, #e5e7eb)',
              borderRadius: '14px',
              padding: '16px 18px',
              boxShadow: 'var(--shadow-card, 0 1px 2px rgba(0,0,0,0.04))'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted, #6b7280)', fontWeight: 600 }}>{note.date}</span>
                <span style={{
                  padding: '2px 6px',
                  borderRadius: '4px',
                  fontSize: '10px',
                  fontWeight: 700,
                  backgroundColor: 'rgba(59, 130, 246, 0.08)',
                  color: '#2563eb'
                }}>
                  {note.tag}
                </span>
              </div>
              <button
                onClick={() => handleDeleteNote(note.id)}
                style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', padding: '2px' }}
              >
                <Trash2 size={13} />
              </button>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text-primary, #111827)', margin: 0, lineHeight: 1.5 }}>
              {note.content}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
