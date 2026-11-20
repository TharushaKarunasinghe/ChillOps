import { describe, expect, it } from 'vitest';
import { USER_ROLES, type UserRole } from '@chillops/shared/auth';
import { createApp } from '../../app';
import { TestRepository } from '../auth/test-repository.ts';
import { AuthService } from '../auth/service.ts';
import { JobsService } from './service.ts';
import { TestJobsRepository, testInput, testJob } from './test-repository.ts';
const origin = 'http://localhost:5173';
async function fixture(role: UserRole = 'ops') {
  const auth = new TestRepository();
  auth.user!.role = role;
  const repo = new TestJobsRepository();
  const app = createApp(
    new AuthService(auth, {
      hash: async () => '',
      verify: async () => true,
      needsRehash: () => false,
    }),
    new JobsService(repo),
  );
  const login = await app.request(origin + '/api/auth/login', {
    method: 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'operator@example.invalid',
      password: 'synthetic password',
    }),
  });
  const cookie = login.headers.get('Set-Cookie')!.split(';')[0]!;
  const request = (path: string, body?: unknown) =>
    app.request(origin + path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: {
        Cookie: cookie,
        Origin: origin,
        'Content-Type': 'application/json',
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  return { app, repo, request };
}
describe('jobs routes', () => {
  it('accepts a valid 4,000-character Unicode description within the jobs body limit', async () => {
    const { request } = await fixture();
    expect(
      (
        await request('/api/jobs', {
          ...testInput,
          description: '\u0d85'.repeat(4000),
        })
      ).status,
    ).toBe(201);
    expect(
      (
        await request('/api/jobs', {
          ...testInput,
          description: 'x'.repeat(4001),
        })
      ).status,
    ).toBe(422);
  });
  it('requires a session on jobs and all lookups', async () => {
    const { app } = await fixture();
    for (const path of [
      '/api/jobs',
      `/api/jobs/${testJob.id}`,
      '/api/lookups/customers',
      '/api/lookups/branches',
      '/api/lookups/equipment',
    ])
      expect((await app.request(origin + path)).status).toBe(401);
    expect(
      (
        await app.request(origin + '/api/jobs', {
          method: 'POST',
          headers: { Origin: origin },
          body: '{}',
        })
      ).status,
    ).toBe(401);
  });
  for (const role of USER_ROLES)
    it(`enforces ${role} read, create and lookup access`, async () => {
      const { request } = await fixture(role);
      const read = role === 'ops' || role === 'director';
      for (const path of ['/api/jobs', `/api/jobs/${testJob.id}`])
        expect((await request(path)).status).toBe(read ? 200 : 403);
      for (const path of [
        '/api/lookups/customers',
        `/api/lookups/branches?customer_id=${testJob.customer.id}`,
        `/api/lookups/equipment?branch_id=${testJob.branch.id}`,
      ])
        expect((await request(path)).status).toBe(role === 'ops' ? 200 : 403);
      const created = await request('/api/jobs', testInput);
      expect(created.status).toBe(role === 'ops' ? 201 : 403);
      if (role === 'ops')
        expect(created.headers.get('Location')).toMatch(/^\/api\/jobs\//);
    });
  it('returns clean 422 responses for malformed IDs, filters, JSON and ownership', async () => {
    const { request, app } = await fixture();
    for (const path of [
      '/api/jobs/not-a-uuid',
      '/api/jobs?page_size=101',
      '/api/jobs?priority=unknown',
      '/api/lookups/branches?customer_id=bad',
    ]) {
      const r = await request(path);
      expect(r.status).toBe(422);
      expect(await r.json()).toHaveProperty('fields');
    }
    const bad = await request('/api/jobs', {
      ...testInput,
      branch_id: '00000000-0000-4000-8000-000000000999',
    });
    expect(bad.status).toBe(422);
    expect(await bad.json()).toHaveProperty('fields.branch_id');
    expect(
      (
        await request('/api/jobs', {
          ...testInput,
          equipment_id: '00000000-0000-4000-8000-000000000999',
        })
      ).status,
    ).toBe(422);
    expect((await request('/api/jobs', null)).status).toBe(422);
    expect(
      (await app.request(origin + '/api/jobs', { method: 'POST', body: '{}' }))
        .status,
    ).toBe(403);
  });
  it('returns 404 for absent jobs and does not register a status-changing endpoint', async () => {
    const { request } = await fixture();
    expect(
      (await request('/api/jobs/00000000-0000-4000-8000-000000000999')).status,
    ).toBe(404);
    expect(
      (await request(`/api/jobs/${testJob.id}/status`, { status: 'assigned' }))
        .status,
    ).toBe(404);
  });
  it('hides insertion failures and leaves the fake store unchanged', async () => {
    const { request, repo } = await fixture();
    repo.failAt = 'event';
    const response = await request('/api/jobs', testInput);
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: 'Jobs service is unavailable. Try again later.',
    });
    expect(repo.jobs).toHaveLength(1);
  });
});
