/**
 * tokenEncryption.js
 * ─────────────────────────────────────────────────────────────────────────────
 * AES-256-GCM encryption & decryption utility for persistent OAuth refresh tokens.
 * Uses Web Crypto API (SubtleCrypto) with a 256-bit key derived from environment variables.
 */

const KEY_MATERIAL = (() => {
  try {
    return (
      (typeof import.meta !== 'undefined' && import.meta.env && (import.meta.env.VITE_TOKEN_ENCRYPTION_KEY || import.meta.env.VITE_ENCRYPTION_KEY)) ||
      (typeof process !== 'undefined' && process.env && (process.env.VITE_TOKEN_ENCRYPTION_KEY || process.env.TOKEN_ENCRYPTION_KEY)) ||
      'foxtrade-gdrive-aes-256-gcm-master-key-2026'
    );
  } catch {
    return 'foxtrade-gdrive-aes-256-gcm-master-key-2026';
  }
})();

let _cachedCryptoKey = null;

/**
 * Derives a CryptoKey for AES-256-GCM using SHA-256 digest of key material.
 */
async function getCryptoKey() {
  if (_cachedCryptoKey) return _cachedCryptoKey;

  const subtle = typeof crypto !== 'undefined' ? crypto.subtle : null;
  if (!subtle) {
    throw new Error('Web Crypto API (crypto.subtle) is not available in this environment.');
  }

  const enc = new TextEncoder();
  const keyBytes = enc.encode(KEY_MATERIAL);
  const hash = await subtle.digest('SHA-256', keyBytes);

  _cachedCryptoKey = await subtle.importKey(
    'raw',
    hash,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );

  return _cachedCryptoKey;
}

/**
 * Encrypt a plaintext token using AES-256-GCM.
 * @param {string} plaintext
 * @returns {Promise<string>} Base64-encoded payload (IV + ciphertext)
 */
export async function encryptToken(plaintext) {
  if (!plaintext || typeof plaintext !== 'string') return '';

  const subtle = typeof crypto !== 'undefined' ? crypto.subtle : null;
  if (!subtle) {
    // Graceful fallback for non-crypto environments
    return btoa(unescape(encodeURIComponent(plaintext)));
  }

  try {
    const key = await getCryptoKey();
    const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV recommended for GCM
    const enc = new TextEncoder();
    const data = enc.encode(plaintext);

    const ciphertext = await subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      data
    );

    const combined = new Uint8Array(iv.byteLength + ciphertext.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(ciphertext), iv.byteLength);

    // Convert to base64
    let binary = '';
    const len = combined.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(combined[i]);
    }
    return btoa(binary);
  } catch (err) {
    console.error('[tokenEncryption] Encryption failed:', err);
    throw err;
  }
}

/**
 * Decrypt an AES-256-GCM encrypted base64 token string.
 * @param {string} encryptedBase64
 * @returns {Promise<string|null>} Decrypted plaintext or null if failed
 */
export async function decryptToken(encryptedBase64) {
  if (!encryptedBase64 || typeof encryptedBase64 !== 'string') return null;

  const subtle = typeof crypto !== 'undefined' ? crypto.subtle : null;
  if (!subtle) {
    try {
      return decodeURIComponent(escape(atob(encryptedBase64)));
    } catch {
      return null;
    }
  }

  try {
    const binary = atob(encryptedBase64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    // IV is the first 12 bytes
    if (bytes.length < 13) return null;
    const iv = bytes.slice(0, 12);
    const ciphertext = bytes.slice(12);

    const key = await getCryptoKey();
    const decrypted = await subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ciphertext
    );

    const dec = new TextDecoder();
    return dec.decode(decrypted);
  } catch (err) {
    // If decryption fails, might be legacy base64 plaintext fallback
    try {
      return decodeURIComponent(escape(atob(encryptedBase64)));
    } catch {
      console.warn('[tokenEncryption] Decryption failed:', err.message);
      return null;
    }
  }
}
