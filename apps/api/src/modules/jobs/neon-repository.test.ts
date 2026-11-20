import { afterEach, describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
import { readFileSync } from 'node:fs';
import { createJobStatement } from './create-statement.ts';
import { createJobsRepository, listJobsStatement } from './neon-repository.ts';
import { testInput, testJob } from './test-repository.ts';
const dialect = new PgDialect();
const url = 'postgresql://synthetic:synthetic@db.example.invalid/synthetic';
afterEach(() => vi.unstubAllGlobals());
function intercept(rows: Record<string, unknown>[]) {
  const requests: { query: string; params: unknown[] }[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: unknown, init: RequestInit) => {
      requests.push(JSON.parse(String(init.body)));
      const keys = Object.keys(rows[0] ?? {});
      return Response.json({
        fields: keys.map((name) => ({
          name,
          dataTypeID: ['total'].includes(name) ? 23 : 3802,
        })),
        rows: rows.map((row) =>
          keys.map((k) => (row[k] === null ? null : JSON.stringify(row[k]))),
        ),
        command: 'SELECT',
        rowCount: rows.length,
        rowAsArray: true,
      });
    }),
  );
  return requests;
}
describe('jobs SQL and Neon HTTP construction (no database)', () => {
  it('keeps the reviewed SQL identical to the production statement', () => {
    const reviewed = readFileSync(
      new URL('../../../../../docs/jobs-create.sql', import.meta.url),
      'utf8',
    )
      .replace(/\r\n/g, '\n')
      .split('\n')
      .filter((line) => !line.startsWith('--'))
      .join('\n')
      .trim();
    expect(reviewed).toBe(
      dialect
        .sqlToQuery(createJobStatement(testInput, testJob.created_by!.id))
        .sql.trim() + ';',
    );
  });
  it('validates a successful create response from RETURNING data', async () => {
    const event = testJob.events[0]!;
    const requests = intercept([
      {
        error_field: null,
        job: {
          id: testJob.id,
          job_number: testJob.job_number,
          job_type: testJob.job_type,
          priority: testJob.priority,
          current_status: 'unassigned',
          reported_at: testJob.reported_at,
          description: testJob.description,
          source: 'manual',
          created_at: testJob.created_at,
          updated_at: testJob.updated_at,
        },
        initial_event: { ...event, actor_id: event.actor!.id },
        customer: testJob.customer,
        branch: testJob.branch,
        equipment: testJob.equipment,
        actor: testJob.created_by,
        audit_id: '00000000-0000-4000-8000-000000000777',
      },
    ]);
    expect(
      await createJobsRepository(url).create(testInput, testJob.created_by!.id),
    ).toEqual({ error_field: null, job: testJob });
    expect(requests).toHaveLength(1);
  });
  it('uses one window count, joined names, explicit CASE order and an empty-page fallback', async () => {
    const requests = intercept([{ items: [], total: 51 }]);
    expect(
      await createJobsRepository(url).list({
        page: 99,
        page_size: 25,
        status: ['pending', 'unassigned'],
        priority: 'urgent',
        job_type: 'breakdown',
        customer_id: testInput.customer_id,
        branch_id: testInput.branch_id,
      }),
    ).toEqual({
      items: [],
      total: 51,
      total_pages: 3,
      page: 99,
      page_size: 25,
    });
    expect(requests).toHaveLength(1);
    const query = requests[0]!.query;
    expect(query).toMatch(/count\(\*\) OVER\(\)/i);
    expect(query.match(/count\(/gi)).toHaveLength(1);
    expect(query).toMatch(
      /WHEN 'critical' THEN 1 WHEN 'urgent' THEN 2 WHEN 'routine' THEN 3/,
    );
    expect(query).toContain('ORDER BY priority_order,reported_at,id');
    expect(query).toContain('SELECT total FROM filtered LIMIT 1');
    expect(query).toContain('JOIN customers');
    expect(query).toContain('JOIN branches');
    expect(requests[0]!.params).toContain('pending');
    expect(requests[0]!.params).toContain(testInput.customer_id);
  });
  it('returns zero total for an empty dataset', async () => {
    intercept([{ items: [], total: 0 }]);
    expect(
      await createJobsRepository(url).list({ page: 1, page_size: 25 }),
    ).toMatchObject({ items: [], total: 0, total_pages: 0 });
  });
  it('parameterizes all filters and keeps user text out of SQL', () => {
    const query = dialect.sqlToQuery(
      listJobsStatement({
        page: 2,
        page_size: 100,
        customer_id: testInput.customer_id,
      }),
    );
    expect(query.sql).not.toContain(testInput.customer_id);
    expect(query.params).toContain(testInput.customer_id);
  });
  it('creates via one dependent statement with structured ownership errors and row locks', async () => {
    const requests = intercept([{ error_field: 'branch_id', job: null }]);
    expect(
      await createJobsRepository(url).create(testInput, testJob.created_by!.id),
    ).toEqual({ error_field: 'branch_id', job: null });
    expect(requests).toHaveLength(1);
    const query = requests[0]!.query;
    expect(query.match(/FOR SHARE/g)).toHaveLength(3);
    for (const field of ['customer_id', 'branch_id', 'equipment_id'])
      expect(query).toContain(`THEN '${field}'`);
    expect(query).toContain('WHERE error_field IS NULL RETURNING *');
    expect(query).toContain(
      "SELECT id, NULL, 'unassigned', created_by, reported_at FROM created RETURNING *",
    );
    expect(query).toContain(
      'FROM created j JOIN initial_event e ON e.job_id = j.id RETURNING id',
    );
    expect(query).not.toContain(testInput.description);
    expect(requests[0]!.params).toContain(testInput.description);
    expect(query).toBe(
      dialect.sqlToQuery(createJobStatement(testInput, testJob.created_by!.id))
        .sql,
    );
  });
  it('sends no follow-up query after an event insert fails', async () => {
    const fetch = vi.fn(async () =>
      Response.json(
        { message: 'Synthetic insert rejected', code: '23514' },
        { status: 400 },
      ),
    );
    vi.stubGlobal('fetch', fetch);
    await expect(
      createJobsRepository(url).create(testInput, testJob.created_by!.id),
    ).rejects.toThrow();
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('joins event actors and orders the history in the detail query', async () => {
    const requests = intercept([{ job: testJob }]);
    expect(await createJobsRepository(url).detail(testJob.id)).toEqual(testJob);
    expect(requests).toHaveLength(1);
    expect(requests[0]!.query).toContain(
      'ORDER BY v.occurred_at,v.created_at,v.id',
    );
    expect(requests[0]!.query).toContain(
      'LEFT JOIN users a ON a.id=v.actor_id',
    );
  });
});
