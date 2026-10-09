/**
 * electron-db/database.js
 * ─────────────────────────────────────────────────────────────────────────────
 * SQLite Database Connection & Migration Manager for FoxTrade Desktop.
 * Uses better-sqlite3 with WAL journal mode and foreign key constraints.
 */

import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { app } from 'electron';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let _db = null;
let _dbPath = null;
let _screenshotsDir = null;

/**
 * Resolve standard userData path across environments (Electron or Node CLI)
 */
export function resolveUserDataPath() {
  if (app && typeof app.getPath === 'function') {
    try {
      return app.getPath('userData');
    } catch (_) {}
  }
  // Fallback for dev / CLI tools
  return path.join(process.cwd(), '.foxtrade_data');
}

/**
 * Initializes and returns the SQLite database connection.
 * @param {string} [customDbPath]
 * @returns {Database.Database}
 */
export function getDatabase(customDbPath = null) {
  if (_db) return _db;

  const baseDir = customDbPath ? path.dirname(customDbPath) : resolveUserDataPath();
  if (!fs.existsSync(baseDir)) {
    fs.mkdirSync(baseDir, { recursive: true });
  }

  _screenshotsDir = path.join(baseDir, 'screenshots');
  if (!fs.existsSync(_screenshotsDir)) {
    fs.mkdirSync(_screenshotsDir, { recursive: true });
  }

  _dbPath = customDbPath || path.join(baseDir, 'foxtrade.db');
  console.log(`[FoxTrade SQLite] Opening database at: ${_dbPath}`);

  _db = new Database(_dbPath, {
    verbose: process.env.NODE_ENV === 'development' ? null : null,
  });

  // Enable WAL mode & foreign keys
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');
  _db.pragma('synchronous = NORMAL');

  // Run versioned migrations
  runMigrations(_db);

  return _db;
}

/**
 * Creates an automatic timestamped backup copy of the database file in userData/backups/
 * Flushes WAL and keeps only the last 5 backups.
 * @param {string} [label='update']
 * @returns {string|null} Path to backup file
 */
export function backupDatabase(label = 'update') {
  try {
    const baseDir = resolveUserDataPath();
    const dbPath = _dbPath || path.join(baseDir, 'foxtrade.db');
    if (!fs.existsSync(dbPath)) return null;

    // Checkpoint WAL journal to ensure complete integrity
    if (_db && _db.open) {
      try {
        _db.pragma('wal_checkpoint(TRUNCATE)');
      } catch (e) {
        console.warn('[FoxTrade SQLite] WAL checkpoint warning prior to backup:', e.message);
      }
    }

    const backupsDir = path.join(baseDir, 'backups');
    if (!fs.existsSync(backupsDir)) {
      fs.mkdirSync(backupsDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFileName = `foxtrade_backup_${timestamp}_${label}.db`;
    const backupFilePath = path.join(backupsDir, backupFileName);

    fs.copyFileSync(dbPath, backupFilePath);
    console.log(`[FoxTrade SQLite] Automatic backup created successfully: ${backupFilePath}`);

    // Retain only the last 5 backups
    const existing = fs.readdirSync(backupsDir)
      .filter(f => f.startsWith('foxtrade_backup_') && f.endsWith('.db'))
      .map(f => ({
        name: f,
        path: path.join(backupsDir, f),
        mtime: fs.statSync(path.join(backupsDir, f)).mtimeMs
      }))
      .sort((a, b) => b.mtime - a.mtime);

    if (existing.length > 5) {
      for (let i = 5; i < existing.length; i++) {
        try {
          fs.unlinkSync(existing[i].path);
          console.log(`[FoxTrade SQLite] Pruned older backup: ${existing[i].name}`);
        } catch (_) {}
      }
    }

    return backupFilePath;
  } catch (err) {
    console.error('[FoxTrade SQLite] Backup creation failed:', err);
    return null;
  }
}

/**
 * Close database connection safely (flushes WAL, releases file handles)
 */
export function closeDatabase() {
  if (_db) {
    try {
      if (_db.open) {
        _db.pragma('wal_checkpoint(TRUNCATE)');
      }
      _db.close();
      console.log('[FoxTrade SQLite] Database connection closed cleanly.');
    } catch (err) {
      console.warn('[FoxTrade SQLite] Notice on closing database:', err.message);
    }
    _db = null;
  }
}

/**
 * Get the screenshots directory path on disk
 */
export function getScreenshotsDir() {
  if (!_screenshotsDir) {
    const baseDir = resolveUserDataPath();
    _screenshotsDir = path.join(baseDir, 'screenshots');
    if (!fs.existsSync(_screenshotsDir)) {
      fs.mkdirSync(_screenshotsDir, { recursive: true });
    }
  }
  return _screenshotsDir;
}

/**
 * Applies schema migrations based on PRAGMA user_version.
 * Automatically backs up prior to migration and restores on failure.
 * @param {Database.Database} db
 */
export function runMigrations(db) {
  const currentVersion = db.pragma('user_version', { simple: true });

  if (currentVersion === 0) {
    console.log('[FoxTrade SQLite] Applying Initial Migration v1 (schema.sql)...');
    const backupPath = backupDatabase('pre_v1_migration');
    const schemaSqlPath = path.join(__dirname, 'schema.sql');
    const schemaSql = fs.readFileSync(schemaSqlPath, 'utf8');

    try {
      db.transaction(() => {
        db.exec(schemaSql);
        db.prepare(`
          INSERT OR IGNORE INTO schema_migrations (version, name, applied_at)
          VALUES (1, '001_initial_schema', ?)
        `).run(new Date().toISOString());
      })();

      db.pragma('user_version = 1');
      console.log('[FoxTrade SQLite] Migration v1 applied successfully.');
    } catch (migErr) {
      console.error('[FoxTrade SQLite] Migration v1 failed:', migErr);
      if (backupPath && fs.existsSync(backupPath)) {
        try {
          db.close();
          fs.copyFileSync(backupPath, _dbPath);
          console.log('[FoxTrade SQLite] Rolled back database to pre-migration backup state.');
        } catch (rollbackErr) {
          console.error('[FoxTrade SQLite] Critical: Failed to restore backup after migration failure:', rollbackErr);
        }
      }
      throw new Error(`Database migration failed: ${migErr.message}`);
    }
  }
}
