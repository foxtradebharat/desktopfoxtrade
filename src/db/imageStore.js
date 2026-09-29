/**
 * imageStore.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Chart image management — binary blobs in IDB + separate files in Google Drive.
 *
 * Key improvement over Nexus:
 *   Nexus: Base64-encodes images into the backup JSON → 30MB+ files at scale
 *   FoxTrade: Images stored as binary files in Drive → backup JSON stays tiny
 *
 * Local storage: IDB chart_images store (Blob objects — no encoding)
 * Cloud storage: Google Drive /FoxTrade Backups/charts/{portfolioId}/ folder
 *
 * Image compression pipeline (before saving):
 *   1. Draw to canvas at original size
 *   2. Convert to WebP (quality 0.85) — 60-70% smaller than PNG
 *   3. If still > 256KB → reduce quality by 0.10 steps until ≤ 256KB or quality < 0.10
 *   4. If WebP not supported → JPEG at same quality steps
 */

import { idbGet, idbPut, idbDelete, idbGetByIndex, STORES } from './foxtradeDB.js';

// ── Constants ─────────────────────────────────────────────────────────────────
const TARGET_SIZE_BYTES = 256 * 1024; // 256 KB target
const INITIAL_QUALITY   = 0.85;
const QUALITY_STEP      = 0.10;
const MIN_QUALITY       = 0.10;
const DRIVE_API         = 'https://www.googleapis.com/drive/v3/files';
const DRIVE_UPLOAD_API  = 'https://www.googleapis.com/upload/drive/v3/files';

// ── Compression ───────────────────────────────────────────────────────────────

/**
 * Compress an image Blob to WebP (or JPEG fallback) targeting ≤ 256KB.
 * @param {Blob} blob — original image blob
 * @returns {Promise<{blob: Blob, mimeType: string, sizeBytes: number}>}
 */
async function compressImage(blob) {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);

    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas    = document.createElement('canvas');
      canvas.width    = img.naturalWidth;
      canvas.height   = img.naturalHeight;
      const ctx       = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);

      const supportsWebP = canvas.toDataURL('image/webp').startsWith('data:image/webp');
      const mimeType     = supportsWebP ? 'image/webp' : 'image/jpeg';

      let quality = INITIAL_QUALITY;

      const tryCompress = () => {
        canvas.toBlob((compressed) => {
          if (!compressed) { resolve({ blob, mimeType: blob.type, sizeBytes: blob.size }); return; }

          if (compressed.size <= TARGET_SIZE_BYTES || quality <= MIN_QUALITY) {
            resolve({ blob: compressed, mimeType, sizeBytes: compressed.size });
          } else {
            quality = Math.max(MIN_QUALITY, quality - QUALITY_STEP);
            tryCompress();
          }
        }, mimeType, quality);
      };

      tryCompress();
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve({ blob, mimeType: blob.type, sizeBytes: blob.size });
    };

    img.src = url;
  });
}

// ── Drive folder helpers ──────────────────────────────────────────────────────

async function getOrCreateFolder(accessToken, name, parentId = null) {
  const parentQ = parentId ? ` and '${parentId}' in parents` : '';
  const q       = `name='${name}' and mimeType='application/vnd.google-apps.folder' and trashed=false${parentQ}`;
  const resp    = await fetch(`${DRIVE_API}?q=${encodeURIComponent(q)}&fields=files(id)&pageSize=1`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const { files } = await resp.json();
  if (files?.[0]?.id) return files[0].id;

  const body = { name, mimeType: 'application/vnd.google-apps.folder' };
  if (parentId) body.parents = [parentId];
  const create = await fetch(DRIVE_API, {
    method:  'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  });
  return (await create.json()).id;
}

/**
 * Get or create the charts subfolder for a portfolio.
 * Path: FoxTrade Backups/charts/{portfolioId}/
 * @param {string} accessToken
 * @param {string} portfolioId
 * @returns {Promise<string>} folder ID
 */
async function getDriveChartsFolder(accessToken, portfolioId) {
  const rootId    = await getOrCreateFolder(accessToken, 'FoxTrade Backups');
  const chartsId  = await getOrCreateFolder(accessToken, 'charts', rootId);
  return getOrCreateFolder(accessToken, portfolioId, chartsId);
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Save a chart image for a trade.
 * Compresses to WebP, stores blob in IDB, marks as pending Drive sync.
 *
 * @param {string} portfolioId
 * @param {string} tradeId
 * @param {'beforeEntry'|'afterExit'|'during'|'custom'} imageType
 * @param {Blob} blob
 * @returns {Promise<object>} saved image record
 */
export async function saveImage(portfolioId, tradeId, imageType, blob) {
  const { blob: compressed, mimeType, sizeBytes } = await compressImage(blob);
  const ext      = mimeType === 'image/webp' ? 'webp' : 'jpg';
  const id       = `${portfolioId}:${tradeId}:${imageType}:${Date.now()}`;
  const filename = `${tradeId}-${imageType}.${ext}`;

  const record = {
    id,
    tradeId,
    portfolioId,
    imageType,
    blob:          compressed,
    mimeType,
    sizeBytes,
    filename,
    driveFileId:   null,
    driveFilePath: null,
    syncedToDrive: false,
    createdAt:     Date.now(),
  };

  await idbPut(STORES.CHART_IMAGES, record);
  return record;
}

/**
 * Get all images for a trade (from IDB, includes Blob for display).
 * @param {string} tradeId
 * @returns {Promise<object[]>}
 */
export async function getImagesForTrade(tradeId) {
  return idbGetByIndex(STORES.CHART_IMAGES, 'tradeId', tradeId);
}

/**
 * Create a temporary object URL for displaying an image.
 * Caller MUST call URL.revokeObjectURL() when done to avoid memory leaks.
 *
 * @param {string} imageId
 * @returns {Promise<string|null>} object URL or null if not found
 */
export async function getImageUrl(imageId) {
  const record = await idbGet(STORES.CHART_IMAGES, imageId);
  if (!record?.blob) return null;
  return URL.createObjectURL(record.blob);
}

/**
 * Delete an image from IDB and optionally from Drive.
 * @param {string} imageId
 * @param {string} [accessToken] — if provided, also deletes from Drive
 * @returns {Promise<void>}
 */
export async function deleteImage(imageId, accessToken) {
  const record = await idbGet(STORES.CHART_IMAGES, imageId);

  // Delete from Drive if synced
  if (record?.driveFileId && accessToken) {
    try {
      await fetch(`${DRIVE_API}/${record.driveFileId}`, {
        method:  'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
    } catch (err) {
      console.warn('[ImageStore] Drive delete failed:', err.message);
    }
  }

  await idbDelete(STORES.CHART_IMAGES, imageId);
}

/**
 * Get all images pending Drive upload for a portfolio.
 * @param {string} portfolioId
 * @returns {Promise<object[]>}
 */
export async function getUnsyncedImages(portfolioId) {
  const all = await idbGetByIndex(STORES.CHART_IMAGES, 'portfolioId', portfolioId);
  return all.filter(img => !img.syncedToDrive);
}

/**
 * Upload all unsynced images to Google Drive as separate binary files.
 * Images are stored in: FoxTrade Backups/charts/{portfolioId}/{filename}
 *
 * @param {string} accessToken
 * @param {string} portfolioId
 * @returns {Promise<{uploaded: number, failed: number}>}
 */
export async function syncPendingImages(accessToken, portfolioId) {
  const unsynced = await getUnsyncedImages(portfolioId);
  if (unsynced.length === 0) return { uploaded: 0, failed: 0 };

  let uploaded = 0;
  let failed   = 0;

  let folderId;
  try {
    folderId = await getDriveChartsFolder(accessToken, portfolioId);
  } catch (err) {
    console.error('[ImageStore] Could not get Drive charts folder:', err.message);
    return { uploaded: 0, failed: unsynced.length };
  }

  for (const img of unsynced) {
    try {
      const metadata = { name: img.filename, parents: [folderId] };
      const form     = new FormData();
      form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
      form.append('file',     img.blob);

      const resp = await fetch(`${DRIVE_UPLOAD_API}?uploadType=multipart&fields=id`, {
        method:  'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        body:    form,
      });

      if (!resp.ok) throw new Error(`Upload failed: ${resp.status}`);
      const { id: driveFileId } = await resp.json();

      // Update IDB record with Drive file ID
      await idbPut(STORES.CHART_IMAGES, {
        ...img,
        driveFileId,
        driveFilePath: `FoxTrade Backups/charts/${portfolioId}/${img.filename}`,
        syncedToDrive: true,
      });

      uploaded++;
    } catch (err) {
      console.warn(`[ImageStore] Failed to upload image ${img.id}:`, err.message);
      failed++;
    }
  }

  return { uploaded, failed };
}

/**
 * Get a count of images per trade for the fast-lookup badge.
 * Returns a Map of tradeId → count.
 * @param {string} portfolioId
 * @returns {Promise<Map<string, number>>}
 */
export async function getImageCountMap(portfolioId) {
  const all    = await idbGetByIndex(STORES.CHART_IMAGES, 'portfolioId', portfolioId);
  const counts = new Map();
  for (const img of all) {
    counts.set(img.tradeId, (counts.get(img.tradeId) || 0) + 1);
  }
  return counts;
}
