import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Search,
  Plus,
  StickyNote,
  ClipboardList,
  BookOpen,
  Target,
  Pin,
  Trash2,
  Check,
  ListOrdered,
  List as ListIcon,
  Quote,
  Code
} from 'lucide-react';
import {
  getIndependentNotes,
  saveIndependentNotes,
  subscribeToIndependentNotes,
} from '../../db/noteStore';

const IND_CATEGORIES = [
  { key: 'notes', label: 'Notes', icon: StickyNote },
  { key: 'tasks', label: 'Tasks', icon: ClipboardList },
  { key: 'resources', label: 'Resources', icon: BookOpen },
  { key: 'goals', label: 'Goals', icon: Target },
];

export default function PlaybookScratchpad({ user }) {
  const [notes, setNotes] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('foxtrade_independent_notes_v2')) || [];
    } catch {
      return [];
    }
  });

  const [activeCategory, setActiveCategory] = useState('notes');
  const [selectedId, setSelectedId] = useState(null);
  const [search, setSearch] = useState('');

  // Keep synced across components and IndexedDB in real time
  useEffect(() => {
    getIndependentNotes().then(idbNotes => {
      if (Array.isArray(idbNotes) && idbNotes.length > 0) setNotes(idbNotes);
    });
    return subscribeToIndependentNotes(updatedNotes => {
      setNotes(updatedNotes);
    });
  }, []);

  const persist = useCallback((updated) => {
    setNotes(updated);
    saveIndependentNotes(updated);
  }, []);

  const filtered = notes.filter(n =>
    n.category === activeCategory &&
    ((n.title || '').toLowerCase().includes(search.toLowerCase()) ||
     (n.content || '').toLowerCase().includes(search.toLowerCase()))
  );

  const sortedFiltered = [...filtered].sort((a, b) => {
    if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
    return new Date(b.updatedAt) - new Date(a.updatedAt);
  });

  const selectedNote = notes.find(n => n.id === selectedId) || null;

  const createNote = () => {
    const note = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      title: '',
      content: '',
      tags: [],
      category: activeCategory,
      isPinned: false,
      priority: 'medium',
      progress: 0,
      status: 'todo',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    const updated = [note, ...notes];
    persist(updated);
    setSelectedId(note.id);
  };

  const updateNote = (id, changes) => {
    persist(notes.map(n => n.id === id ? { ...n, ...changes, updatedAt: new Date().toISOString() } : n));
  };

  const deleteNote = (id) => {
    persist(notes.filter(n => n.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const pinNote = (id) => {
    persist(notes.map(n => n.id === id ? { ...n, isPinned: !n.isPinned } : n));
  };

  const statusColors = { todo: '#9ca3af', in_progress: '#f59e0b', done: '#10b981' };

  return (
    <div style={{
      display: 'flex',
      height: 'calc(100vh - 220px)',
      background: 'var(--bg-surface)',
      border: '1px solid color-mix(in srgb, var(--border-color) 25%, transparent)',
      borderRadius: 12,
      overflow: 'hidden'
    }}>
      {/* Sidebar */}
      <div style={{
        width: 280,
        minWidth: 240,
        background: 'var(--bg-card)',
        borderRight: '1px solid color-mix(in srgb, var(--border-color) 20%, transparent)',
        display: 'flex',
        flexDirection: 'column'
      }}>
        <div style={{ padding: '12px 12px 0', display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {IND_CATEGORIES.map(cat => (
            <button
              key={cat.key}
              onClick={() => { setActiveCategory(cat.key); setSelectedId(null); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                padding: '5px 10px',
                borderRadius: 20,
                fontSize: 11,
                cursor: 'pointer',
                border: activeCategory === cat.key
                  ? '1px solid color-mix(in srgb, var(--border-color) 40%, transparent)'
                  : '1px solid color-mix(in srgb, var(--border-color) 25%, transparent)',
                background: activeCategory === cat.key
                  ? 'color-mix(in srgb, var(--text-primary) 9%, var(--bg-surface))'
                  : 'var(--bg-surface)',
                color: activeCategory === cat.key ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontWeight: activeCategory === cat.key ? 600 : 450,
                transition: 'all 0.18s ease'
              }}
            >
              <cat.icon size={11} />
              {cat.label}
            </button>
          ))}
        </div>

        <div style={{ padding: '10px 12px', display: 'flex', gap: 6 }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <Search size={12} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search scratchpad..."
              style={{
                width: '100%',
                paddingLeft: 28,
                paddingRight: 8,
                height: 30,
                border: '1px solid color-mix(in srgb, var(--border-color) 25%, transparent)',
                borderRadius: 8,
                background: 'var(--bg-surface)',
                fontSize: 12,
                color: 'var(--text-primary)',
                outline: 'none',
                fontFamily: 'inherit',
                boxSizing: 'border-box'
              }}
            />
          </div>
          <button
            onClick={createNote}
            style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              border: '1px solid color-mix(in srgb, var(--border-color) 35%, transparent)',
              background: 'color-mix(in srgb, var(--text-primary) 8%, var(--bg-surface))',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              transition: 'all 0.18s ease'
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'color-mix(in srgb, var(--text-primary) 12%, var(--bg-surface))'}
            onMouseLeave={e => e.currentTarget.style.background = 'color-mix(in srgb, var(--text-primary) 8%, var(--bg-surface))'}
          >
            <Plus size={13} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {sortedFiltered.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center' }}>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 10 }}>No {activeCategory} yet</p>
              <button
                onClick={createNote}
                style={{
                  padding: '6px 14px',
                  borderRadius: 8,
                  border: '1px dashed color-mix(in srgb, var(--border-color) 35%, transparent)',
                  background: 'none',
                  fontSize: 12,
                  color: 'var(--text-secondary)',
                  cursor: 'pointer'
                }}
              >
                Create first
              </button>
            </div>
          ) : (
            sortedFiltered.map(note => (
              <div
                key={note.id}
                onClick={() => setSelectedId(note.id)}
                style={{
                  padding: '10px 12px',
                  cursor: 'pointer',
                  borderBottom: '1px solid color-mix(in srgb, var(--border-color) 18%, transparent)',
                  background: selectedId === note.id ? 'var(--bg-primary)' : 'transparent',
                  borderLeft: selectedId === note.id ? '3px solid var(--text-primary)' : '3px solid transparent'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: selectedId === note.id ? 600 : 450, color: 'var(--text-primary)', lineHeight: 1.3, flex: 1, wordBreak: 'break-word' }}>
                    {note.isPinned && <Pin size={11} color="#f59e0b" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: 4 }} />}{note.title || 'Untitled'}
                  </span>
                  <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
                    <button
                      onClick={e => { e.stopPropagation(); pinNote(note.id); }}
                      title={note.isPinned ? 'Unpin' : 'Pin'}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: note.isPinned ? '#f59e0b' : 'var(--text-muted)', padding: 2 }}
                    >
                      <Pin size={11} />
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); deleteNote(note.id); }}
                      title="Delete"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2 }}
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                  <span style={{ fontSize: 10, color: statusColors[note.status] || '#9ca3af', fontWeight: 700, textTransform: 'uppercase' }}>
                    {(note.status || '').replace('_', ' ')}
                  </span>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                    {new Date(note.updatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Editor Panel */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {!selectedNote ? (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, color: 'var(--text-muted)' }}>
            <StickyNote size={36} style={{ opacity: 0.3 }} />
            <p style={{ fontSize: 14 }}>Select a note or task to edit</p>
            <button
              onClick={createNote}
              style={{
                padding: '8px 18px',
                borderRadius: 9,
                border: '1px solid color-mix(in srgb, var(--border-color) 35%, transparent)',
                background: 'color-mix(in srgb, var(--text-primary) 8%, var(--bg-surface))',
                color: 'var(--text-primary)',
                fontSize: 13,
                fontWeight: 550,
                cursor: 'pointer',
                transition: 'all 0.18s ease'
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'color-mix(in srgb, var(--text-primary) 12%, var(--bg-surface))'}
              onMouseLeave={e => e.currentTarget.style.background = 'color-mix(in srgb, var(--text-primary) 8%, var(--bg-surface))'}
            >
              + New {activeCategory.slice(0, -1)}
            </button>
          </div>
        ) : (
          <ScratchpadEditor
            key={selectedNote.id}
            note={selectedNote}
            onChange={ch => updateNote(selectedNote.id, ch)}
            onDelete={() => deleteNote(selectedNote.id)}
          />
        )}
      </div>
    </div>
  );
}

function ScratchpadEditor({ note, onChange, onDelete }) {
  const [title, setTitle] = useState(note.title || '');
  const [status, setStatus] = useState(note.status || 'todo');
  const [priority, setPriority] = useState(note.priority || 'medium');
  const [progress, setProgress] = useState(note.progress || 0);
  const [saveStatus, setSaveStatus] = useState('saved'); // 'saved' | 'saving'
  const [lastSavedTime, setLastSavedTime] = useState(() => new Date(note.updatedAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
  const editorRef = useRef(null);
  const saveTimeoutRef = useRef(null);

  useEffect(() => {
    setTitle(note.title || '');
    setStatus(note.status || 'todo');
    setPriority(note.priority || 'medium');
    setProgress(note.progress || 0);
    if (editorRef.current) editorRef.current.innerHTML = note.content || '';
    setSaveStatus('saved');
    setLastSavedTime(new Date(note.updatedAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
  }, [note.id]);

  const handleSaveImmediate = () => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    onChange({
      title,
      status,
      priority,
      progress,
      content: editorRef.current?.innerHTML || ''
    });
    setSaveStatus('saved');
    setLastSavedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
  };

  const handleSave = handleSaveImmediate;

  const handleAutoSave = (newTitle = title) => {
    setSaveStatus('saving');
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      onChange({
        title: newTitle,
        status,
        priority,
        progress,
        content: editorRef.current?.innerHTML || ''
      });
      setSaveStatus('saved');
      setLastSavedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    }, 600);
  };

  const execCmd = (cmd, val = null) => {
    document.execCommand(cmd, false, val);
    editorRef.current?.focus();
    handleAutoSave();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-surface)' }}>
      <div style={{ padding: '12px 18px', borderBottom: '1px solid color-mix(in srgb, var(--border-color) 20%, transparent)', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <input
          id="scratchpad-note-title"
          name="noteTitle"
          value={title}
          onChange={e => {
            setTitle(e.target.value);
            handleAutoSave(e.target.value);
          }}
          placeholder="Untitled Note"
          style={{ flex: 1, minWidth: 140, border: 'none', outline: 'none', fontSize: 16, fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--text-primary)', background: 'transparent', fontFamily: 'inherit' }}
        />

        {/* Persistence Status Badge */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
          padding: '3px 8px',
          borderRadius: 6,
          background: saveStatus === 'saving' ? 'rgba(245,158,11,0.08)' : 'rgba(16,185,129,0.08)',
          color: saveStatus === 'saving' ? '#f59e0b' : '#10b981',
          fontSize: 11,
          fontWeight: 500
        }}>
          {saveStatus === 'saving' ? (
            <span>Saving...</span>
          ) : (
            <>
              <Check size={12} strokeWidth={2} />
              <span>Saved ({lastSavedTime})</span>
            </>
          )}
        </div>

        <button
          onClick={handleSaveImmediate}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            padding: '5px 14px',
            borderRadius: 7,
            border: '1px solid color-mix(in srgb, var(--border-color) 35%, transparent)',
            background: 'color-mix(in srgb, var(--text-primary) 8%, var(--bg-surface))',
            color: 'var(--text-primary)',
            fontSize: 11.5,
            fontWeight: 550,
            cursor: 'pointer',
            transition: 'all 0.18s ease'
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'color-mix(in srgb, var(--text-primary) 12%, var(--bg-surface))'}
          onMouseLeave={e => e.currentTarget.style.background = 'color-mix(in srgb, var(--text-primary) 8%, var(--bg-surface))'}
        >
          Save
        </button>
        <button
          onClick={onDelete}
          aria-label="Delete note"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 4, borderRadius: 6, display: 'flex', opacity: 0.6 }}
        >
          <Trash2 size={14} />
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 18px', borderBottom: '1px solid color-mix(in srgb, var(--border-color) 18%, transparent)' }}>
        <button onClick={() => execCmd('bold')} style={{ background: 'none', border: 'none', padding: 4, cursor: 'pointer', fontWeight: 700, fontSize: 12 }}>B</button>
        <button onClick={() => execCmd('italic')} style={{ background: 'none', border: 'none', padding: 4, cursor: 'pointer', fontStyle: 'italic', fontSize: 12 }}>I</button>
        <button onClick={() => execCmd('underline')} style={{ background: 'none', border: 'none', padding: 4, cursor: 'pointer', textDecoration: 'underline', fontSize: 12 }}>U</button>
      </div>

      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={() => handleAutoSave()}
        style={{ flex: 1, overflowY: 'auto', padding: '16px 18px', fontSize: 13.5, lineHeight: 1.65, color: 'var(--text-primary)', outline: 'none' }}
      />
    </div>
  );
}
