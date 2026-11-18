import { describe, expect, it } from 'vitest';
import app from './index';
import * as entry from './index';

describe('Worker entry exports', () => {
  it('exports only the default handler', () => {
    expect(Object.keys(entry)).toEqual(['default']);
  });
});

describe('API routing', () => {
  it('returns JSON health at /api/health', async () => {
    const response = await app.request('/api/health');
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toContain('application/json');
    expect(await response.json()).toEqual({ status: 'ok' });
  });

  it('returns JSON 404 for unknown API paths, including browser navigation', async () => {
    const response = await app.request('/api/not-found', {
      headers: { Accept: 'text/html', 'Sec-Fetch-Mode': 'navigate' },
    });
    expect(response.status).toBe(404);
    expect(response.headers.get('Content-Type')).toContain('application/json');
    expect(await response.json()).toEqual({ error: 'Not found' });
  });

  it('does not expose the old health route in the Worker', async () => {
    expect((await app.request('/health')).status).toBe(404);
  });
});
