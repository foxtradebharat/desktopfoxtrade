import React, { useState, useRef, useEffect } from 'react';
import {
  Plus,
  Trash2,
  Check,
  Edit2,
  FileText,
  ListOrdered,
  List as ListIcon,
  Quote,
  Code,
  Link2,
  Undo,
  Redo,
  MoreVertical,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Image as ImageIcon,
  Loader2
} from 'lucide-react';
import { compressImage } from '../../utils/imageCompression';

export default function PlaybookNotesTab({
  playbook,
  onUpdatePlaybook
}) {
  const notes = playbook.notes || [];
  const [selectedNoteId, setSelectedNoteId] = useState(() => notes[0]?.id || null);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState('');
  const [isSaved, setIsSaved] = useState(false);
  const [isCompressingImage, setIsCompressingImage] = useState(false);
  const editorRef = useRef(null);
  const imageInputRef = useRef(null);

  const selectedNote = notes.find(n => n.id === selectedNoteId) || notes[0] || null;

  const handleInsertImage = async (file) => {
    if (!file) return;
    try {
      setIsCompressingImage(true);
      const compressedUrl = await compressImage(file, { maxDimension: 1200, quality: 0.72 });
      if (compressedUrl && editorRef.current) {
        editorRef.current.focus();
        document.execCommand('insertHTML', false, `<p><img src="${compressedUrl}" alt="Chart screenshot" style="max-width: 100%; border-radius: 8px; margin: 10px 0; border: 1px solid rgba(255,255,255,0.12);" /></p><p><br></p>`);
        handleAutoSave();
      }
    } catch (err) {
      console.error('Failed to compress note image', err);
    } finally {
      setIsCompressingImage(false);
    }
  };

  const handlePaste = async (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type && items[i].type.indexOf('image') !== -1) {
        e.preventDefault();
        const blob = items[i].getAsFile();
        if (blob) {
          await handleInsertImage(blob);
        }
        break;
      }
    }
  };

  useEffect(() => {
    if (selectedNote) {
      setTitleInput(selectedNote.title || 'Untitled Note');
      if (editorRef.current) {
        editorRef.current.innerHTML = selectedNote.content || '';
      }
    }
  }, [selectedNote?.id]);

  const execCmd = (cmd, val = null) => {
    document.execCommand(cmd, false, val);
    editorRef.current?.focus();
    handleAutoSave();
  };

  const handleAutoSave = () => {
    if (!selectedNote) return;
    const content = editorRef.current?.innerHTML || '';
    const updatedNotes = notes.map(n => {
      if (n.id === selectedNote.id) {
        return {
          ...n,
          title: titleInput,
          content,
          updatedAt: new Date().toISOString()
        };
      }
      return n;
    });

    onUpdatePlaybook({
      ...playbook,
      notes: updatedNotes,
      updatedAt: new Date().toISOString()
    });

    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  const handleAddNote = () => {
    const newNote = {
      id: 'note-' + Date.now().toString(36),
      title: 'New Setup Note',
      content: '<p>Document setup rules, context, and key patterns here...</p>',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const updated = [newNote, ...notes];
    onUpdatePlaybook({
      ...playbook,
      notes: updated,
      updatedAt: new Date().toISOString()
    });
    setSelectedNoteId(newNote.id);
  };

  const handleDeleteNote = (id) => {
    if (notes.length <= 1) {
      alert('You must keep at least one note for this playbook.');
      return;
    }
    if (!confirm('Are you sure you want to delete this note?')) return;
    const filtered = notes.filter(n => n.id !== id);
    onUpdatePlaybook({
      ...playbook,
      notes: filtered,
      updatedAt: new Date().toISOString()
    });
    setSelectedNoteId(filtered[0]?.id || null);
  };

  const handleTitleSubmit = () => {
    setIsEditingTitle(false);
    handleAutoSave();
  };

  const formatDate = (isoStr) => {
    if (!isoStr) return '';
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return isoStr;
    }
  };

  return (
    <div style={{
      display: 'flex',
      height: 'calc(100vh - 270px)',
      minHeight: 520,
      background: 'var(--bg-surface)',
      border: '1px solid color-mix(in srgb, var(--border-color) 25%, transparent)',
      borderRadius: 12,
      overflow: 'hidden'
    }}>
      {/* ── Left Sidebar (matching Image 1) ──────────────────────────────── */}
      <div style={{
        width: 260,
        minWidth: 220,
        background: 'var(--bg-card)',
        borderRight: '1px solid color-mix(in srgb, var(--border-color) 20%, transparent)',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* + Add Note button */}
        <div style={{ padding: '14px 14px 10px' }}>
          <button
            onClick={handleAddNote}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              padding: '8px 12px',
              borderRadius: 8,
              border: '1px solid color-mix(in srgb, var(--border-color) 25%, transparent)',
              background: 'var(--bg-surface)',
              color: 'var(--text-primary)',
              fontSize: 12,
              fontWeight: 550,
              cursor: 'pointer',
              transition: 'all 0.15s'
            }}
            onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--text-primary)'}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--border-color) 25%, transparent)'}
          >
            <Plus size={13} />
            <span>Add Note</span>
          </button>
        </div>

        {/* Note List */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {notes.map(note => {
            const isSelected = selectedNote?.id === note.id;
            return (
              <div
                key={note.id}
                onClick={() => setSelectedNoteId(note.id)}
                style={{
                  padding: '12px 16px',
                  cursor: 'pointer',
                  borderBottom: '1px solid color-mix(in srgb, var(--border-color) 18%, transparent)',
                  background: isSelected ? 'var(--bg-primary)' : 'transparent',
                  borderLeft: isSelected ? '3px solid var(--text-primary)' : '3px solid transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                  transition: 'background 0.12s'
                }}
                onMouseEnter={e => {
                  if (!isSelected) e.currentTarget.style.background = 'var(--bg-primary)';
                }}
                onMouseLeave={e => {
                  if (!isSelected) e.currentTarget.style.background = 'transparent';
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 12.5,
                    fontWeight: isSelected ? 600 : 450,
                    color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}>
                    {note.title || 'Untitled Note'}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                    {formatDate(note.updatedAt || note.createdAt)}
                  </div>
                </div>

                {notes.length > 1 && (
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      handleDeleteNote(note.id);
                    }}
                    title="Delete Note"
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      padding: 2,
                      display: 'flex',
                      opacity: isSelected ? 0.7 : 0.25
                    }}
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Right Content / Editor (matching Image 1) ────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-surface)' }}>
        {selectedNote ? (
          <>
            {/* Header with Title and Metadata */}
            <div style={{
              padding: '16px 22px 12px',
              borderBottom: '1px solid color-mix(in srgb, var(--border-color) 20%, transparent)',
              display: 'flex',
              flexDirection: 'column',
              gap: 4
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
                  {isEditingTitle ? (
                    <input
                      autoFocus
                      value={titleInput}
                      onChange={e => setTitleInput(e.target.value)}
                      onBlur={handleTitleSubmit}
                      onKeyDown={e => e.key === 'Enter' && handleTitleSubmit()}
                      style={{
                        fontSize: 17,
                        fontWeight: 600,
                        letterSpacing: '-0.01em',
                        color: 'var(--text-primary)',
                        background: 'var(--bg-primary)',
                        border: '1px solid color-mix(in srgb, var(--border-color) 40%, transparent)',
                        borderRadius: 6,
                        padding: '2px 8px',
                        outline: 'none',
                        width: '70%'
                      }}
                    />
                  ) : (
                    <h2 style={{
                      fontSize: 17,
                      fontWeight: 600,
                      letterSpacing: '-0.01em',
                      color: 'var(--text-primary)',
                      margin: 0,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8
                    }}>
                      <span>{selectedNote.title || 'Untitled Note'}</span>
                      <button
                        onClick={() => setIsEditingTitle(true)}
                        title="Edit Title"
                        style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', padding: 2, opacity: 0.6 }}
                      >
                        <Edit2 size={13} />
                      </button>
                    </h2>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {isSaved && (
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#10b981', display: 'flex', alignItems: 'center', gap: 3 }}>
                      <Check size={12} strokeWidth={2.5} /> Saved
                    </span>
                  )}
                  <button
                    onClick={handleAutoSave}
                    style={{
                      padding: '5px 12px',
                      borderRadius: 6,
                      border: '1px solid color-mix(in srgb, var(--border-color) 25%, transparent)',
                      background: 'var(--bg-card)',
                      color: 'var(--text-primary)',
                      fontSize: 11.5,
                      fontWeight: 500,
                      cursor: 'pointer'
                    }}
                  >
                    Save
                  </button>
                </div>
              </div>

              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                Created: {formatDate(selectedNote.createdAt)} &bull; Last updated: {formatDate(selectedNote.updatedAt)}
              </div>
            </div>

            {/* Rich Formatting Toolbar (matching Image 1) */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '8px 18px',
              borderBottom: '1px solid color-mix(in srgb, var(--border-color) 18%, transparent)',
              background: 'var(--bg-card)',
              flexWrap: 'wrap'
            }}>
              <ToolBtn title="Bold (Ctrl+B)" onClick={() => execCmd('bold')}>
                <span style={{ fontWeight: 700, fontSize: 12 }}>B</span>
              </ToolBtn>
              <ToolBtn title="Italic (Ctrl+I)" onClick={() => execCmd('italic')}>
                <span style={{ fontStyle: 'italic', fontSize: 12 }}>I</span>
              </ToolBtn>
              <ToolBtn title="Underline (Ctrl+U)" onClick={() => execCmd('underline')}>
                <span style={{ textDecoration: 'underline', fontSize: 12 }}>U</span>
              </ToolBtn>
              <ToolBtn title="Strikethrough" onClick={() => execCmd('strikeThrough')}>
                <span style={{ textDecoration: 'line-through', fontSize: 12 }}>S</span>
              </ToolBtn>

              <div style={{ width: 1, height: 16, background: 'color-mix(in srgb, var(--border-color) 25%, transparent)', margin: '0 4px' }} />

              <ToolBtn title="Align Left" onClick={() => execCmd('justifyLeft')}>
                <AlignLeft size={13} />
              </ToolBtn>
              <ToolBtn title="Align Center" onClick={() => execCmd('justifyCenter')}>
                <AlignCenter size={13} />
              </ToolBtn>
              <ToolBtn title="Align Right" onClick={() => execCmd('justifyRight')}>
                <AlignRight size={13} />
              </ToolBtn>

              <div style={{ width: 1, height: 16, background: 'color-mix(in srgb, var(--border-color) 25%, transparent)', margin: '0 4px' }} />

              <ToolBtn title="Bullet List" onClick={() => execCmd('insertUnorderedList')}>
                <ListIcon size={13} />
              </ToolBtn>
              <ToolBtn title="Numbered List" onClick={() => execCmd('insertOrderedList')}>
                <ListOrdered size={13} />
              </ToolBtn>

              <div style={{ width: 1, height: 16, background: 'color-mix(in srgb, var(--border-color) 25%, transparent)', margin: '0 4px' }} />

              <ToolBtn title="Blockquote" onClick={() => execCmd('formatBlock', '<blockquote>')}>
                <Quote size={13} />
              </ToolBtn>
              <ToolBtn title="Code Block" onClick={() => execCmd('formatBlock', '<pre>')}>
                <Code size={13} />
              </ToolBtn>

              <div style={{ width: 1, height: 16, background: 'color-mix(in srgb, var(--border-color) 25%, transparent)', margin: '0 4px' }} />

              <ToolBtn
                title={isCompressingImage ? "Compressing Image..." : "Insert Compressed Chart Image"}
                onClick={() => imageInputRef.current?.click()}
              >
                {isCompressingImage ? <Loader2 size={13} className="animate-spin" /> : <ImageIcon size={13} />}
              </ToolBtn>
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={e => {
                  const f = e.target.files?.[0];
                  if (f) handleInsertImage(f);
                  e.target.value = '';
                }}
              />

              <ToolBtn title="Undo (Ctrl+Z)" onClick={() => execCmd('undo')}>
                <Undo size={13} />
              </ToolBtn>
              <ToolBtn title="Redo (Ctrl+Y)" onClick={() => execCmd('redo')}>
                <Redo size={13} />
              </ToolBtn>
            </div>

            {/* Editor Body */}
            <div
              ref={editorRef}
              contentEditable
              suppressContentEditableWarning
              onInput={handleAutoSave}
              onPaste={handlePaste}
              style={{
                flex: 1,
                padding: '20px 24px',
                overflowY: 'auto',
                outline: 'none',
                fontSize: 13.5,
                lineHeight: 1.7,
                color: 'var(--text-primary)',
                fontFamily: 'inherit'
              }}
            />
          </>
        ) : (
          <div style={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            color: 'var(--text-muted)'
          }}>
            <FileText size={32} style={{ opacity: 0.4 }} />
            <p style={{ fontSize: 13 }}>No note selected</p>
            <button
              onClick={handleAddNote}
              style={{
                padding: '7px 16px',
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
              + Create First Note
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ToolBtn({ title, onClick, children }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: '5px 7px',
        borderRadius: 5,
        color: 'var(--text-secondary)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'background 0.12s'
      }}
      onMouseEnter={e => e.currentTarget.style.background = 'var(--border-color)'}
      onMouseLeave={e => e.currentTarget.style.background = 'none'}
    >
      {children}
    </button>
  );
}
