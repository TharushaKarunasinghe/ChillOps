import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../../app';
import { AuthService } from './service.ts';
import { requireRole } from './middleware.ts';
import { TestRepository } from './test-repository.ts';

const origin = 'http://localhost:5173';
function fixture() {
  const repo = new TestRepository();
  const service = new AuthService(repo, {
    hash: async () => 'current',
    verify: async () => true,
    needsRehash: () => false,
  });
  const app = createApp(service);
  const login = (headers: Record<string, string> = {}) =>
    app.request(origin + '/api/auth/login', {
      method: 'POST',
      headers: {
        Origin: origin,
        'Content-Type': 'application/json',
        ...headers,
      },
      body: JSON.stringify({
        email: 'operator@example.invalid',
        password: 'synthetic password',
      }),
    });
  return { repo, app, login };
}
describe('auth routes and default-deny middleware', () => {
  it('protects newly added and unknown API routes without declarations', async () => {
    const { app } = fixture();
    app.get('/api/new-feature', (c) => c.json({ private: true }));
    for (const path of [
      '/api/new-feature',
      '/api/missing',
      '/api/auth/me',
      '/api',
    ]) {
      expect((await app.request(origin + path)).status).toBe(401);
    }
    expect((await app.request(origin + '/api/health')).status).toBe(200);
  });
  it('requires exact Origin for every non-GET, before login attempts or other writes', async () => {
    const { app, login, repo } = fixture();
    const reserve = vi.spyOn(repo, 'reserveAttempt');
    for (const value of [
      '',
      'null',
      'http://localhost:8787',
      origin + '/',
      origin + '.example.invalid',
      'https://localhost:5173',
    ])
      expect((await login({ Origin: value })).status).toBe(403);
    for (const method of ['POST', 'PUT', 'DELETE', 'OPTIONS', 'HEAD'])
      expect(
        (await app.request(origin + '/api/health', { method })).status,
      ).toBe(403);
    expect(reserve).not.toHaveBeenCalled();
  });
  it('sets cookies, exposes only public user fields, and revokes on logout', async () => {
    const { app, login, repo } = fixture();
    const response = await login();
    expect(response.status).toBe(200);
    const cookie = response.headers.get('Set-Cookie')!;
    expect(cookie).toMatch(
      /^session=[\w-]{43}; HttpOnly; Secure; SameSite=Lax; Path=\/; Max-Age=604800$/,
    );
    const user = await response.json();
    expect(Object.keys(user.user).sort()).toEqual([
      'email',
      'fullName',
      'id',
      'role',
    ]);
    const headers = {
      Cookie: cookie.split(';')[0]!,
      Origin: origin,
      'Content-Type': 'application/json',
    };
    expect(
      await (await app.request(origin + '/api/auth/me', { headers })).json(),
    ).toEqual(user);
    const logout = await app.request(origin + '/api/auth/logout', {
      method: 'POST',
      headers,
      body: '{}',
    });
    expect(logout.status).toBe(200);
    expect(logout.headers.get('Set-Cookie')).toContain('Max-Age=0');
    expect(
      (await app.request(origin + '/api/auth/me', { headers })).status,
    ).toBe(401);
    expect(repo.audits).toEqual(['auth.login', 'auth.logout']);
  });
  it('enforces roles and preserves authenticated JSON 404s', async () => {
    const { app, login } = fixture();
    app.get('/api/director-only', requireRole('director'), (c) =>
      c.json({ ok: true }),
    );
    app.get('/api/ops-only', requireRole('ops'), (c) => c.json({ ok: true }));
    const cookie = (await login()).headers.get('Set-Cookie')!.split(';')[0]!;
    const headers = {
      Cookie: cookie,
      Accept: 'text/html',
      'Sec-Fetch-Mode': 'navigate',
    };
    expect(
      (await app.request(origin + '/api/director-only', { headers })).status,
    ).toBe(403);
    expect(
      (await app.request(origin + '/api/ops-only', { headers })).status,
    ).toBe(200);
    const missing = await app.request(origin + '/api/missing', { headers });
    expect(missing.status).toBe(404);
    expect(await missing.json()).toEqual({ error: 'Not found' });
  });
  it('handles absent and invalid IPs without storing invalid inet values', async () => {
    for (const headers of [
      {},
      { 'CF-Connecting-IP': 'invalid' },
      { 'CF-Connecting-IP': '203.0.113.5' },
    ] as Record<string, string>[]) {
      const { login, repo } = fixture();
      await login(headers);
      expect(repo.completed[0]?.ip).toBe(
        headers['CF-Connecting-IP'] === '203.0.113.5' ? '203.0.113.5' : null,
      );
    }
  });
  it('sanitizes failures and validates request bodies', async () => {
    const { app, login, repo } = fixture();
    expect(
      (
        await app.request(origin + '/api/auth/login', {
          method: 'POST',
          headers: { Origin: origin },
          body: 'not json',
        })
      ).status,
    ).toBe(400);
    vi.spyOn(repo, 'findUser').mockRejectedValue(
      new Error('private connection string'),
    );
    const response = await login();
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain('private');
  });
});
