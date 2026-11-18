import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAuthRepository } from './neon-repository.ts';

const url = 'postgresql://synthetic:synthetic@db.example.invalid/synthetic';
type Query = { query: string; params: unknown[] };
function intercept(
  results: {
    fields: { name: string; dataTypeID: number }[];
    rows: unknown[][];
  }[],
) {
  const requests: { queries: Query[] }[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: unknown, init: RequestInit) => {
      requests.push(JSON.parse(String(init.body)) as { queries: Query[] });
      return Response.json({
        results: results.map((result) => ({
          ...result,
          command: 'SELECT',
          rowCount: result.rows.length,
          rowAsArray: true,
        })),
      });
    }),
  );
  return requests;
}
const empty = { fields: [], rows: [] };
afterEach(() => vi.unstubAllGlobals());

describe('Neon HTTP transaction construction (no database)', () => {
  it('sends isolation, lock, cleanup and conditional insertion in one HTTP transaction', async () => {
    const requests = intercept([
      empty,
      empty,
      empty,
      {
        fields: [{ name: 'key', dataTypeID: 25 }],
        rows: [['email:synthetic'], ['ip:synthetic']],
      },
    ]);
    const repo = createAuthRepository(url);
    expect(
      await repo.reserveAttempt(
        'email:synthetic',
        'ip:synthetic',
        new Date('2026-01-02T00:00:00Z'),
      ),
    ).toBe(true);
    expect(requests).toHaveLength(1);
    const queries = requests[0]!.queries;
    expect(queries).toHaveLength(4);
    expect(queries[0]!.query).toMatch(
      /set transaction isolation level read committed/i,
    );
    expect(queries[1]!.query).toContain('pg_advisory_xact_lock');
    expect(queries[2]!.query).toContain('delete from login_attempts');
    expect(queries[2]!.params).toContain('2026-01-01T00:00:00.000Z');
    expect(queries[3]!.query).toMatch(
      /insert into login_attempts[\s\S]+select candidate.key/,
    );
    expect(queries[3]!.params).toContain('5');
    expect(queries[3]!.params).toContain('20');
    expect(queries[3]!.params).toContain('2026-01-01T23:45:00.000Z');
  });
  it('treats no inserted rows as rate limited', async () => {
    intercept([empty, empty, empty, empty]);
    expect(
      await createAuthRepository(url).reserveAttempt(
        'email:synthetic',
        'ip:synthetic',
        new Date(),
      ),
    ).toBe(false);
  });
  it('keeps upgrade, rotation, email-only reset and audit in the login transaction', async () => {
    const publicUser = {
      id: '00000000-0000-4000-8000-000000000001',
      fullName: 'Fictional Operator',
      email: 'operator@example.invalid',
      role: 'ops',
    };
    const requests = intercept([
      empty,
      empty,
      {
        fields: Object.keys(publicUser).map((name) => ({
          name,
          dataTypeID: 25,
        })),
        rows: [Object.values(publicUser)],
      },
    ]);
    const repo = createAuthRepository(url);
    expect(
      await repo.completeLogin({
        userId: publicUser.id,
        expectedPasswordHash: 'synthetic-old',
        replacementHash: 'synthetic-new',
        tokenHash: 'synthetic-token-hash',
        oldTokenHash: 'synthetic-old-token-hash',
        emailKey: 'email:synthetic',
        now: new Date('2026-01-01'),
        expiresAt: new Date('2026-01-08'),
        ip: null,
        userAgent: null,
      }),
    ).toEqual(publicUser);
    expect(requests).toHaveLength(1);
    const queries = requests[0]!.queries;
    expect(queries[1]!.query).toContain('pg_advisory_xact_lock');
    const query = queries[2]!;
    for (const fragment of [
      'for update',
      'update users set password_hash',
      'insert into sessions',
      'update sessions set revoked_at',
      'delete from login_attempts where key =',
      'insert into audit_log',
    ])
      expect(query.query).toContain(fragment);
    expect(query.params).toContain('email:synthetic');
    expect(query.params).not.toContain('ip:synthetic');
  });
});
