import { describe, expect, it } from 'vitest';
import app from './index';
import * as entry from './index';

const webOrigin = 'http://localhost:5173';
const bindings = { WEB_ORIGIN: webOrigin };

describe('Worker entry exports', () => {
  it('exports only the default handler', () => {
    expect(Object.keys(entry)).toEqual(['default']);
  });
});

describe('GET /health', () => {
  it('returns public JSON health without an Origin header', async () => {
    const response = await app.request('/health', {}, bindings);

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toContain('application/json');
    expect(await response.json()).toEqual({ status: 'ok' });
    expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });

  it('allows the exact configured origin', async () => {
    const response = await app.request(
      '/health',
      { headers: { Origin: webOrigin } },
      bindings,
    );

    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(webOrigin);
    expect(response.headers.get('Vary')).toContain('Origin');
  });

  it.each([
    'http://localhost:5173.evil.example',
    'http://localhost:51730',
    'http://localhost:5173/',
    'https://localhost:5173',
    'https://other.example',
    'null',
  ])('does not allow a different origin: %s', async (origin) => {
    const response = await app.request(
      '/health',
      { headers: { Origin: origin } },
      bindings,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });

  it.each([undefined, '', '*'])(
    'does not allow an unset or wildcard configuration: %s',
    async (configuredOrigin) => {
      const response = await app.request(
        '/health',
        { headers: { Origin: webOrigin } },
        { WEB_ORIGIN: configuredOrigin },
      );

      expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
    },
  );
});

describe('OPTIONS /health', () => {
  it('answers preflight for the exact configured origin', async () => {
    const response = await app.request(
      '/health',
      {
        method: 'OPTIONS',
        headers: { Origin: webOrigin, 'Access-Control-Request-Method': 'GET' },
      },
      bindings,
    );

    expect(response.status).toBe(204);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(webOrigin);
    expect(
      response.headers.get('Access-Control-Allow-Methods')?.split(','),
    ).toContain('GET');
    expect(response.headers.get('Access-Control-Allow-Methods')).not.toContain(
      'POST',
    );
    expect(await response.text()).toBe('');
  });

  it.each([webOrigin + '.evil.example', webOrigin + '/', 'null', ''])(
    'does not allow preflight from an unmatched origin: %s',
    async (origin) => {
      const response = await app.request(
        '/health',
        {
          method: 'OPTIONS',
          headers: {
            ...(origin ? { Origin: origin } : {}),
            'Access-Control-Request-Method': 'GET',
          },
        },
        bindings,
      );

      expect(response.status).toBe(204);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
    },
  );
});
