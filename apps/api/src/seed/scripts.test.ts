import { describe, expect, it, vi } from 'vitest';
import { generateSeed, SEED_IDS, TABLES } from './data.ts';

const supportPath = '../../scripts/seed-support.mjs';
const {
  confirmHost,
  demoPassword,
  validateArguments,
  transaction,
  insertSeed,
  resetSeed,
} = await import(supportPath);
describe('seed command controls without a database', () => {
  it('requires exact host confirmation and the reset bypass flag', async () => {
    await expect(
      confirmHost('synthetic.example', async () => 'synthetic.example'),
    ).resolves.toBeUndefined();
    for (const answer of ['', 'yes', 'other.example', 'synthetic.example '])
      await expect(
        confirmHost('synthetic.example', async () => answer),
      ).rejects.toThrow();
    expect(() => validateArguments([], true)).toThrow();
    expect(() =>
      validateArguments(['--allow-append-only-bypass'], true),
    ).not.toThrow();
    expect(() => validateArguments(['password'])).toThrow();
  });
  it('requires two identical hidden password inputs and shared validation', async () => {
    const read = vi.fn().mockResolvedValue('fictional demo password');
    await expect(demoPassword(read)).resolves.toBe('fictional demo password');
    expect(read).toHaveBeenCalledTimes(2);
    await expect(
      demoPassword(
        vi
          .fn()
          .mockResolvedValueOnce('fictional demo password')
          .mockResolvedValueOnce('different demo password'),
      ),
    ).rejects.toThrow();
    await expect(demoPassword(async () => 'short')).rejects.toThrow();
  });
  it('inserts chronologically and skips every existing ID, including job defaults, on rerun', async () => {
    const saved = new Map<string, Set<string>>(
      TABLES.map((t) => [t, new Set()]),
    );
    const inserts: { table: string; row: Record<string, unknown> }[] = [];
    const client = {
      query: vi.fn(async (sql: string, values: unknown[] = []) => {
        const selected = /^SELECT id FROM (\w+)/.exec(sql)?.[1];
        if (selected)
          return { rows: [...saved.get(selected)!].map((id) => ({ id })) };
        const match = /^INSERT INTO (\w+) \(([^)]+)\)/.exec(sql);
        if (match) {
          const table = match[1]!;
          const row = Object.fromEntries(
            match[2]!.split(', ').map((c, i) => [c, values[i]]),
          );
          saved.get(table)!.add(String(row.id));
          inserts.push({ table, row });
        }
        return { rows: [] };
      }),
    };
    const hash = vi.fn(async () => 'synthetic-test-hash');
    const data = generateSeed(new Date('2026-11-20'));
    data.jobs.reverse(); // The writer independently guarantees insertion order.
    await insertSeed(client, data, 'synthetic password', hash);
    expect(hash).toHaveBeenCalledTimes(15);
    const jobs = inserts
      .filter((r) => r.table === 'jobs')
      .map((r) => r.row.reported_at);
    expect(jobs).toEqual([...jobs].sort());
    const count = inserts.length;
    await insertSeed(
      client,
      generateSeed(new Date('2026-11-21')),
      'another password',
      hash,
    );
    expect(inserts).toHaveLength(count);
    expect(hash).toHaveBeenCalledTimes(15);
  });
  function resetClient(failAt?: string) {
    let guards = [true, true];
    let snapshot = [...guards];
    const calls: { sql: string; values: unknown[] }[] = [];
    return {
      calls,
      enabled: () => guards.every(Boolean),
      query: async (sql: string, values: unknown[] = []) => {
        calls.push({ sql, values });
        if (sql === 'BEGIN') snapshot = [...guards];
        if (sql === 'ROLLBACK') guards = [...snapshot];
        if (sql.startsWith('SELECT tgname'))
          return {
            rows: [
              { tgname: 'job_events_append_only', tgenabled: 'O' },
              { tgname: 'audit_log_append_only', tgenabled: 'O' },
            ],
          };
        if (sql === failAt) throw new Error('Synthetic failure');
        if (sql.startsWith('ALTER TABLE'))
          guards[sql.includes('job_events') ? 0 : 1] =
            sql.includes('ENABLE TRIGGER');
        return { rows: [] };
      },
    };
  }
  it('restricts deletes to seed IDs or seeded user ownership and enables guards before commit', async () => {
    const client = resetClient();
    await transaction(client, resetSeed);
    expect(client.enabled()).toBe(true);
    const deletes = client.calls.filter((c) => c.sql.startsWith('DELETE'));
    expect(deletes).toHaveLength(TABLES.length + 2);
    for (const call of deletes) {
      expect(call.sql).toMatch(
        /WHERE (id|user_id|actor_id) = ANY\(\$1::uuid\[\]\)/,
      );
      expect(Object.values(SEED_IDS)).toContainEqual(call.values[0]);
    }
    expect(client.calls.at(-3)?.sql).toBe(
      'ALTER TABLE job_events ENABLE TRIGGER job_events_append_only',
    );
    expect(client.calls.at(-2)?.sql).toBe(
      'ALTER TABLE audit_log ENABLE TRIGGER audit_log_append_only',
    );
    expect(client.calls.at(-1)?.sql).toBe('COMMIT');
  });
  it('rolls back trigger changes at every failure point, including re-enable failures', async () => {
    const success = resetClient();
    await transaction(success, resetSeed);
    for (const call of success.calls.filter(
      (c) => c.sql.startsWith('ALTER') || c.sql.startsWith('DELETE'),
    )) {
      const client = resetClient(call.sql);
      await expect(transaction(client, resetSeed)).rejects.toThrow(
        'Synthetic failure',
      );
      expect(client.enabled()).toBe(true);
      expect(client.calls.at(-1)?.sql).toBe('ROLLBACK');
      expect(client.calls.some((c) => c.sql === 'COMMIT')).toBe(false);
    }
  });
  it('refuses reset with missing or already disabled guards', async () => {
    const query = vi.fn(async (sql: string) => ({
      rows: sql.startsWith('SELECT tgname')
        ? [{ tgenabled: 'D' }, { tgenabled: 'O' }]
        : [],
    }));
    await expect(transaction({ query }, resetSeed)).rejects.toThrow();
    expect(query.mock.calls.some(([sql]) => sql.startsWith('ALTER'))).toBe(
      false,
    );
  });
  it('runs checks inside a read-only repeatable-read transaction', async () => {
    const query = vi.fn(async () => ({ rows: [] }));
    await transaction({ query }, async () => {}, true);
    expect(query).toHaveBeenNthCalledWith(
      1,
      'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY',
    );
  });
});
