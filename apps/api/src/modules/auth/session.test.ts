import { describe, expect, it } from 'vitest';
import {
  cookieName,
  newSessionToken,
  readSessionToken,
  sessionCookie,
  sessionIsValid,
  SESSION_IDLE_MS,
  validIp,
} from './session.ts';

describe('sessions', () => {
  it('generates independent 32-byte bearer tokens and SHA-256 hashes', async () => {
    const a = await newSessionToken(),
      b = await newSessionToken();
    expect(a.token).toMatch(/^[\w-]{43}$/);
    expect(a.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(a.token).not.toBe(b.token);
    expect(a.tokenHash).not.toBe(b.tokenHash);
  });
  it('uses secure host-only cookies, including localhost flags and deletion', () => {
    expect(cookieName('http://localhost:5173')).toBe('session');
    expect(cookieName('https://localhost')).toBe('__Host-session');
    expect(cookieName('https://example.invalid')).toBe('__Host-session');
    expect(sessionCookie('https://example.invalid', 'test')).toBe(
      '__Host-session=test; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=604800',
    );
    expect(sessionCookie('http://localhost:5173', null)).toBe(
      'session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0',
    );
    expect(
      readSessionToken(
        new Request('http://localhost', { headers: { Cookie: 'session=bad' } }),
      ),
    ).toBeNull();
  });
  it('rejects exact expiry and idle boundaries, revoked sessions and inactive users', () => {
    const now = new Date('2026-01-02T00:00:00Z');
    const valid = {
      active: true,
      revokedAt: null,
      expiresAt: new Date(now.getTime() + 1),
      lastSeenAt: new Date(now.getTime() - SESSION_IDLE_MS + 1),
    };
    expect(sessionIsValid(valid, now)).toBe(true);
    expect(sessionIsValid({ ...valid, expiresAt: now }, now)).toBe(false);
    expect(
      sessionIsValid(
        { ...valid, lastSeenAt: new Date(now.getTime() - SESSION_IDLE_MS) },
        now,
      ),
    ).toBe(false);
    expect(sessionIsValid({ ...valid, revokedAt: now }, now)).toBe(false);
    expect(sessionIsValid({ ...valid, active: false }, now)).toBe(false);
  });
  it('validates IP addresses without throwing on missing or malformed input', () => {
    expect(validIp(null)).toBeNull();
    expect(validIp('not-an-ip')).toBeNull();
    expect(validIp('1.2.3.4/24')).toBeNull();
    expect(validIp('999.2.3.4')).toBeNull();
    expect(validIp('127.0.0.1')).toBe('127.0.0.1');
    expect(validIp('::1')).toBe('::1');
  });
});
