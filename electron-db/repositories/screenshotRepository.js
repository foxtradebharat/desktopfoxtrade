/**
 * electron-db/repositories/screenshotRepository.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Screenshot files saved on disk in app userData directory, metadata in SQLite.
 */

import fs from 'node:fs';
import path from 'node:path';
import { getDatabase, getScreenshotsDir } from '../database.js';

export function saveScreenshot(tradeId, imageType, bufferOrBase64, customFilename = null) {
  const db = getDatabase();
  const dir = getScreenshotsDir();
  const now = new Date().toISOString();

  let buffer;
  let ext = 'webp';
  let mimeType = 'image/webp';

  if (typeof bufferOrBase64 === 'string') {
    if (bufferOrBase64.startsWith('data:image/')) {
      const match = bufferOrBase64.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
      if (match) {
        mimeType = match[1];
        ext = mimeType.includes('png') ? 'png' : mimeType.includes('jpeg') ? 'jpg' : 'webp';
        buffer = Buffer.from(match[2], 'base64');
      } else {
        buffer = Buffer.from(bufferOrBase64);
      }
    } else {
      buffer = Buffer.from(bufferOrBase64, 'base64');
    }
  } else if (Buffer.isBuffer(bufferOrBase64)) {
    buffer = bufferOrBase64;
  } else if (bufferOrBase64 instanceof Uint8Array || bufferOrBase64 instanceof ArrayBuffer) {
    buffer = Buffer.from(bufferOrBase64);
  } else {
    throw new Error('Unsupported image buffer format.');
  }

  const cleanType = (imageType || 'custom').toLowerCase().replace(/[^a-z0-9]/g, '');
  const fileName = customFilename || `${tradeId}-${cleanType}-${Date.now()}.${ext}`;
  const diskPath = path.join(dir, fileName);
  const relativePath = path.join('screenshots', fileName).replace(/\\/g, '/');

  // Write file to disk
  fs.writeFileSync(diskPath, buffer);
  const sizeBytes = buffer.length;

  const id = `img-${tradeId}-${cleanType}-${Date.now().toString(36)}`;

  db.prepare(`
    INSERT INTO trade_screenshots (
      id, trade_id, image_type, file_path, file_name, file_size_bytes,
      mime_type, created_at, updated_at, deleted_at
    ) VALUES (
      @id, @trade_id, @image_type, @file_path, @file_name, @file_size_bytes,
      @mime_type, @created_at, @updated_at, NULL
    )
  `).run({
    id,
    trade_id: tradeId,
    image_type: cleanType.toUpperCase(),
    file_path: relativePath,
    file_name: fileName,
    file_size_bytes: sizeBytes,
    mime_type: mimeType,
    created_at: now,
    updated_at: now
  });

  return {
    id,
    tradeId,
    imageType: cleanType,
    fileName,
    filePath: relativePath,
    sizeBytes,
    diskPath
  };
}

export function getScreenshotsForTrade(tradeId) {
  const db = getDatabase();
  const rows = db.prepare(`
    SELECT * FROM trade_screenshots
    WHERE trade_id = ? AND deleted_at IS NULL
    ORDER BY created_at ASC
  `).all(tradeId);

  const baseDir = path.dirname(getScreenshotsDir());

  return rows.map(r => {
    const fullPath = path.join(baseDir, r.file_path);
    let dataUrl = null;
    if (fs.existsSync(fullPath)) {
      try {
        const fileBuf = fs.readFileSync(fullPath);
        dataUrl = `data:${r.mime_type};base64,${fileBuf.toString('base64')}`;
      } catch (_) {}
    }

    return {
      id: r.id,
      tradeId: r.trade_id,
      imageType: r.image_type.toLowerCase(),
      fileName: r.file_name,
      filePath: r.file_path,
      sizeBytes: r.file_size_bytes,
      mimeType: r.mime_type,
      dataUrl,
      createdAt: r.created_at
    };
  });
}

export function deleteScreenshot(screenshotId) {
  const db = getDatabase();
  const row = db.prepare(`SELECT * FROM trade_screenshots WHERE id = ?`).get(screenshotId);
  if (!row) return;

  const now = new Date().toISOString();
  db.prepare(`UPDATE trade_screenshots SET deleted_at = ?, updated_at = ? WHERE id = ?`).run(now, now, screenshotId);

  // Optionally delete disk file
  try {
    const baseDir = path.dirname(getScreenshotsDir());
    const fullPath = path.join(baseDir, row.file_path);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }
  } catch (_) {}
}
