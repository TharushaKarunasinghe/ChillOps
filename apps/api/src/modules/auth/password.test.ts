import { timingSafeEqual } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  base64url,
  createPasswordHasher,
  DUMMY_PASSWORD_HASH,
  PASSWORD_ITERATIONS,
} from './password.ts';

const hasher = createPasswordHasher(timingSafeEqual);
describe('PBKDF2 password storage', () => {
  it('uses random salts and a self-describing 100,000-iteration record', async () => {
    const a = await hasher.hash('synthetic password'),
      b = await hasher.hash('synthetic password');
    expect(a).not.toBe(b);
    expect(a).toMatch(/^pbkdf2-sha256\$100000\$[\w-]{22}\$[\w-]{43}$/);
    expect(await hasher.verify('synthetic password', a)).toBe(true);
    expect(await hasher.verify('incorrect password', a)).toBe(false);
    expect(hasher.needsRehash(a)).toBe(false);
    expect(hasher.needsRehash(a.replace('$100000$', '$100001$'))).toBe(true);
    expect(PASSWORD_ITERATIONS).toBe(100000);
  });
  it('normalizes passwords to NFC for both hashing and verification', async () => {
    const record = await hasher.hash('e\u0301'.repeat(12));
    expect(await hasher.verify('é'.repeat(12), record)).toBe(true);
  });
  it('verifies the stored iteration count and requests an upgrade', async () => {
    const salt = new Uint8Array(16);
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode('synthetic password'),
      'PBKDF2',
      false,
      ['deriveBits'],
    );
    const hash = new Uint8Array(
      await crypto.subtle.deriveBits(
        { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 1000 },
        key,
        256,
      ),
    );
    const stored = `pbkdf2-sha256$1000$${base64url(salt)}$${base64url(hash)}`;
    expect(await hasher.verify('synthetic password', stored)).toBe(true);
    expect(hasher.needsRehash(stored)).toBe(true);
  });
  it('rejects malformed records and exercises the dummy hash', async () => {
    for (const record of [
      '',
      'argon2$100000$salt$hash',
      DUMMY_PASSWORD_HASH + '$extra',
      DUMMY_PASSWORD_HASH.replace('$100000$', '$0$'),
    ])
      expect(await hasher.verify('synthetic password', record)).toBe(false);
    expect(await hasher.verify('synthetic password', DUMMY_PASSWORD_HASH)).toBe(
      false,
    );
  });
});
