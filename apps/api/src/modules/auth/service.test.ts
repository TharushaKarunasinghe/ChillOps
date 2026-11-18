import { timingSafeEqual } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { AuthService, BAD_CREDENTIALS } from './service.ts';
import { createPasswordHasher, DUMMY_PASSWORD_HASH } from './password.ts';
import { TestRepository } from './test-repository.ts';
import { SESSION_TOUCH_MS, sha256 } from './session.ts';

const input = {
  email: 'operator@example.invalid',
  password: 'synthetic password',
  ip: null,
  userAgent: null,
  oldToken: null,
};
function fixture() {
  const repo = new TestRepository();
  const passwords = {
    hash: vi.fn(async () => 'upgraded'),
    verify: vi.fn(async () => true),
    needsRehash: vi.fn(() => false),
  };
  let now = new Date('2026-01-01T00:00:00Z');
  return {
    repo,
    passwords,
    service: new AuthService(repo, passwords, () => now),
    advance: (ms: number) => {
      now = new Date(now.getTime() + ms);
    },
  };
}
describe('auth service', () => {
  it('uses identical generic failures and performs dummy work for unknown users', async () => {
    const { repo, passwords, service } = fixture();
    await expect(
      service.login({ ...input, email: 'absent@example.invalid' }),
    ).rejects.toThrow(BAD_CREDENTIALS);
    expect(passwords.verify).toHaveBeenLastCalledWith(
      input.password,
      DUMMY_PASSWORD_HASH,
    );
    passwords.verify.mockResolvedValueOnce(false);
    await expect(service.login(input)).rejects.toThrow(BAD_CREDENTIALS);
    repo.user!.active = false;
    await expect(service.login(input)).rejects.toThrow(BAD_CREDENTIALS);
    expect(passwords.verify).toHaveBeenCalledTimes(3);
    expect(repo.audits).toEqual([]);
  });
  it('upgrades a real lower-cost hash after a successful login and saves it atomically', async () => {
    const repo = new TestRepository(),
      hasher = createPasswordHasher(timingSafeEqual);
    const salt = new Uint8Array(16);
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(input.password),
      'PBKDF2',
      false,
      ['deriveBits'],
    );
    const bits = new Uint8Array(
      await crypto.subtle.deriveBits(
        { name: 'PBKDF2', hash: 'SHA-256', iterations: 1000, salt },
        key,
        256,
      ),
    );
    const encoded = Buffer.from(bits).toString('base64url');
    repo.user!.passwordHash = `pbkdf2-sha256$1000$AAAAAAAAAAAAAAAAAAAAAA$${encoded}`;
    const service = new AuthService(repo, hasher);
    await service.login(input);
    expect(repo.completed[0]?.replacementHash).toContain(
      'pbkdf2-sha256$100000$',
    );
    expect(await hasher.verify(input.password, repo.user!.passwordHash)).toBe(
      true,
    );
    expect(repo.audits).toEqual(['auth.login']);
  });
  it('rotates a carried session, clears only email attempts and logs login/logout', async () => {
    const { repo, service } = fixture();
    const first = await service.login(input);
    const next = await service.login({ ...input, oldToken: first.token });
    expect(next.token).not.toBe(first.token);
    expect(await service.authenticate(first.token)).toBeNull();
    expect(repo.attempts.every((a) => a.key.startsWith('ip:'))).toBe(true);
    expect(repo.attempts).toHaveLength(2);
    const session = await service.authenticate(next.token);
    await service.logout(session!);
    expect(await service.authenticate(next.token)).toBeNull();
    expect(repo.audits).toEqual(['auth.login', 'auth.login', 'auth.logout']);
  });
  it('touches at most every five minutes and rejects inactive users', async () => {
    const { repo, service, advance } = fixture();
    const { token } = await service.login(input);
    advance(SESSION_TOUCH_MS - 1);
    await service.authenticate(token);
    expect(repo.touches).toBe(0);
    advance(1);
    await service.authenticate(token);
    await service.authenticate(token);
    expect(repo.touches).toBe(1);
    repo.user!.active = false;
    expect(await service.authenticate(token)).toBeNull();
  });
  it('blocks the sixth email attempt before hashing and resets after the window', async () => {
    const { service, passwords, advance } = fixture();
    const absent = { ...input, email: 'absent@example.invalid' };
    for (let i = 0; i < 5; i++)
      await expect(service.login(absent)).rejects.toMatchObject({
        status: 401,
      });
    await expect(service.login(absent)).rejects.toMatchObject({ status: 429 });
    expect(passwords.verify).toHaveBeenCalledTimes(5);
    advance(15 * 60 * 1000 + 1);
    await expect(service.login(absent)).rejects.toMatchObject({ status: 401 });
  });
  it('blocks the twenty-first IP attempt across emails and cleans rows older than 24 hours', async () => {
    const { service, repo, advance } = fixture();
    for (let i = 0; i < 20; i++)
      await expect(
        service.login({ ...input, email: `absent${i}@example.invalid` }),
      ).rejects.toMatchObject({ status: 401 });
    await expect(
      service.login({ ...input, email: 'another@example.invalid' }),
    ).rejects.toMatchObject({ status: 429 });
    advance(86400001);
    await service.login(input);
    expect(repo.attempts).toEqual([
      expect.objectContaining({ key: `ip:${await sha256('missing')}` }),
    ]);
  });
});
