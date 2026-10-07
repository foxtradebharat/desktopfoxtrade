import { describe, it, expect } from 'vitest';
import { encryptToken, decryptToken } from '../src/utils/tokenEncryption.js';

describe('tokenEncryption AES-256-GCM', () => {
  it('encrypts and decrypts OAuth refresh tokens successfully', async () => {
    const rawRefreshToken = '1//0gM4p-abcdefg123456789-SampleRefreshToken';
    const encrypted = await encryptToken(rawRefreshToken);
    expect(encrypted).toBeTruthy();
    expect(encrypted).not.toBe(rawRefreshToken);

    const decrypted = await decryptToken(encrypted);
    expect(decrypted).toBe(rawRefreshToken);
  });

  it('handles empty or invalid inputs gracefully', async () => {
    expect(await encryptToken('')).toBe('');
    expect(await decryptToken('')).toBeNull();
    expect(await decryptToken(null)).toBeNull();
  });
});
