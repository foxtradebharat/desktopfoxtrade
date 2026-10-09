/**
 * electron-db/repositories/noteRepository.js
 * ─────────────────────────────────────────────────────────────────────────────
 * SQLite repository for Calendar Daily Notes & Independent Productivity Notes.
 */

import { getDatabase } from '../database.js';

export function getCalendarNotes(portfolioId = 'default') {
  const db = getDatabase();
  const rows = db.prepare(`
    SELECT * FROM notes
    WHERE (portfolio_id = ? OR portfolio_id = 'default')
      AND note_type = 'CALENDAR_DAY'
      AND deleted_at IS NULL
    ORDER BY date_str ASC
  `).all(portfolioId || 'default');

  const result = {};
  rows.forEach(r => {
    let tags = [];
    let scopedNotes = null;
    try { if (r.tags) tags = JSON.parse(r.tags); } catch (_) {}
    try { if (r.scoped_notes) scopedNotes = JSON.parse(r.scoped_notes); } catch (_) {}

    result[r.date_str] = {
      title: r.title || '',
      content: r.content || '',
      mood: r.mood || 'neutral',
      tags,
      scopedNotes,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    };
  });

  return result;
}

export function saveDayNote(portfolioId = 'default', dateStr, noteData) {
  const db = getDatabase();
  const pid = portfolioId || 'default';
  const now = new Date().toISOString();
  const id = `day-${pid}-${dateStr}`;

  db.prepare(`
    INSERT OR IGNORE INTO portfolios (id, name, currency, base_capital_paise, is_default, display_order, created_at, updated_at)
    VALUES (?, 'My Portfolio', 'INR', 10000000, 1, 0, ?, ?)
  `).run(pid, now, now);

  db.prepare(`
    INSERT INTO notes (
      id, portfolio_id, note_type, date_str, title, content, mood, tags, scoped_notes,
      created_at, updated_at, deleted_at
    ) VALUES (
      @id, @portfolio_id, 'CALENDAR_DAY', @date_str, @title, @content, @mood, @tags, @scoped_notes,
      @created_at, @updated_at, NULL
    )
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title,
      content = excluded.content,
      mood = excluded.mood,
      tags = excluded.tags,
      scoped_notes = excluded.scoped_notes,
      updated_at = excluded.updated_at
  `).run({
    id,
    portfolio_id: pid,
    date_str: dateStr,
    title: noteData.title || '',
    content: noteData.content || '',
    mood: noteData.mood || 'neutral',
    tags: JSON.stringify(noteData.tags || []),
    scoped_notes: noteData.scopedNotes ? JSON.stringify(noteData.scopedNotes) : null,
    created_at: noteData.createdAt || now,
    updated_at: now
  });

  return getCalendarNotes(pid);
}

export function deleteDayNote(portfolioId = 'default', dateStr) {
  const db = getDatabase();
  const pid = portfolioId || 'default';
  const id = `day-${pid}-${dateStr}`;
  const now = new Date().toISOString();
  db.prepare(`UPDATE notes SET deleted_at = ?, updated_at = ? WHERE id = ?`).run(now, now, id);
  return getCalendarNotes(pid);
}

export function getIndependentNotes(portfolioId = 'default') {
  const db = getDatabase();
  const rows = db.prepare(`
    SELECT * FROM notes
    WHERE (portfolio_id = ? OR portfolio_id = 'default')
      AND note_type = 'INDEPENDENT'
      AND deleted_at IS NULL
    ORDER BY is_pinned DESC, updated_at DESC
  `).all(portfolioId || 'default');

  return rows.map(r => {
    let tags = [];
    try { if (r.tags) tags = JSON.parse(r.tags); } catch (_) {}
    return {
      id: r.id,
      title: r.title || '',
      content: r.content || '',
      category: r.category || 'notes',
      priority: r.priority || 'medium',
      status: r.status || 'todo',
      progress: r.progress || 0,
      isPinned: Boolean(r.is_pinned),
      color: r.color || undefined,
      tags,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    };
  });
}

export function saveIndependentNote(portfolioId = 'default', note) {
  const db = getDatabase();
  const pid = portfolioId || 'default';
  const now = new Date().toISOString();
  const id = note.id || `ind-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

  db.prepare(`
    INSERT OR IGNORE INTO portfolios (id, name, currency, base_capital_paise, is_default, display_order, created_at, updated_at)
    VALUES (?, 'My Portfolio', 'INR', 10000000, 1, 0, ?, ?)
  `).run(pid, now, now);

  db.prepare(`
    INSERT INTO notes (
      id, portfolio_id, note_type, title, content, category, priority, status,
      progress, is_pinned, color, tags, created_at, updated_at, deleted_at
    ) VALUES (
      @id, @portfolio_id, 'INDEPENDENT', @title, @content, @category, @priority, @status,
      @progress, @is_pinned, @color, @tags, @created_at, @updated_at, NULL
    )
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title,
      content = excluded.content,
      category = excluded.category,
      priority = excluded.priority,
      status = excluded.status,
      progress = excluded.progress,
      is_pinned = excluded.is_pinned,
      color = excluded.color,
      tags = excluded.tags,
      updated_at = excluded.updated_at
  `).run({
    id,
    portfolio_id: pid,
    title: note.title || '',
    content: note.content || '',
    category: note.category || 'notes',
    priority: note.priority || 'medium',
    status: note.status || 'todo',
    progress: typeof note.progress === 'number' ? note.progress : 0,
    is_pinned: note.isPinned ? 1 : 0,
    color: note.color || null,
    tags: JSON.stringify(note.tags || []),
    created_at: note.createdAt || now,
    updated_at: now
  });

  return getIndependentNotes(pid);
}

export function deleteIndependentNote(portfolioId = 'default', id) {
  const db = getDatabase();
  const now = new Date().toISOString();
  db.prepare(`UPDATE notes SET deleted_at = ?, updated_at = ? WHERE id = ?`).run(now, now, id);
  return getIndependentNotes(portfolioId || 'default');
}
