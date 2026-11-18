import { readFileSync } from 'node:fs';
import { JOB_STATUSES } from '@chillops/shared';
import { getTableConfig, PgDialect } from 'drizzle-orm/pg-core';
import { describe, expect, it, vi } from 'vitest';
import * as schema from './schema';
import { createDatabase } from './client';

const tables = [
  schema.users,
  schema.technicians,
  schema.customers,
  schema.customerContacts,
  schema.branches,
  schema.equipment,
  schema.jobs,
  schema.jobEvents,
  schema.auditLog,
];
const dialect = new PgDialect();

describe('offline database schema', () => {
  it('reuses shared statuses and the approved priorities', () => {
    expect(schema.jobStatus.enumValues).toEqual(JOB_STATUSES);
    expect(schema.jobPriority.enumValues).toEqual([
      'routine',
      'urgent',
      'critical',
    ]);
    expect(JOB_STATUSES).toContain('in_transit');
    expect(JOB_STATUSES).toContain('on_site');
  });

  it.each(tables.map((table) => [getTableConfig(table).name, table] as const))(
    '%s has database-generated identity and timezone-aware timestamps',
    (_name, table) => {
      const config = getTableConfig(table);
      const id = config.columns.find((column) => column.name === 'id');
      expect(id?.primary).toBe(true);
      expect(id?.hasDefault).toBe(true);
      expect(
        config.columns.find((column) => column.name === 'created_at')?.notNull,
      ).toBe(true);
      for (const column of config.columns.filter((column) =>
        column.name.endsWith('_at'),
      )) {
        expect(column.getSQLType()).toBe('timestamp with time zone');
        expect(column.notNull).toBe(true);
        expect(column.hasDefault).toBe(true);
      }
      for (const fk of config.foreignKeys) expect(fk.onDelete).toBe('restrict');
    },
  );

  it('preserves nullable system actors with real foreign keys and a manual-job check', () => {
    for (const [table, actor] of [
      [schema.jobs, schema.jobs.createdBy],
      [schema.jobEvents, schema.jobEvents.actorId],
      [schema.auditLog, schema.auditLog.actorId],
    ] as const) {
      expect(actor.notNull).toBe(false);
      expect(
        getTableConfig(table).foreignKeys.some((fk) =>
          fk.reference().columns.includes(actor),
        ),
      ).toBe(true);
    }
    const check = getTableConfig(schema.jobs).checks.find(
      (item) => item.name === 'jobs_manual_actor_required',
    );
    expect(check && dialect.sqlToQuery(check.value).sql).toContain(
      '"source" <> \'manual\' OR "jobs"."created_by" IS NOT NULL',
    );
    expect(schema.users.fullName.notNull).toBe(true);
  });

  it('enforces relationship consistency with composite foreign keys', () => {
    const jobKeys = getTableConfig(schema.jobs).foreignKeys.map((fk) =>
      fk.reference(),
    );
    expect(
      jobKeys.map((key) => key.columns.map((col) => col.name)),
    ).toContainEqual(['branch_id', 'customer_id']);
    expect(
      jobKeys.map((key) => key.columns.map((col) => col.name)),
    ).toContainEqual(['equipment_id', 'branch_id']);
    const contactKeys = getTableConfig(schema.customerContacts).foreignKeys.map(
      (fk) => fk.reference(),
    );
    expect(
      contactKeys.map((key) => key.columns.map((col) => col.name)),
    ).toContainEqual(['branch_id', 'customer_id']);
  });

  it('ships both generated migrations and guards all event mutations', () => {
    const journal = JSON.parse(
      readFileSync(
        new URL('../../drizzle/meta/_journal.json', import.meta.url),
        'utf8',
      ),
    ) as { entries: { tag: string }[] };
    expect(journal.entries.map((entry) => entry.tag)).toEqual([
      '0000_core_schema',
      '0001_database_guards',
    ]);
    const guards = readFileSync(
      new URL('../../drizzle/0001_database_guards.sql', import.meta.url),
      'utf8',
    );
    expect(guards).toMatch(
      /BEFORE UPDATE OR DELETE OR TRUNCATE ON "job_events"\s+FOR EACH STATEMENT/,
    );
    expect(guards).toContain("ERRCODE = '55000'");
    for (const table of tables.slice(0, 7)) {
      expect(guards).toContain(
        `BEFORE UPDATE ON "${getTableConfig(table).name}"`,
      );
    }
  });

  it('constructs the HTTP client without connecting to a database', () => {
    const fetch = vi.spyOn(globalThis, 'fetch');
    try {
      const db = createDatabase(
        'postgresql://synthetic:synthetic@db.example.invalid/synthetic',
      );
      expect(db.select().from(schema.jobs).toSQL().sql).toContain(
        'from "jobs"',
      );
      expect(fetch).not.toHaveBeenCalled();
    } finally {
      fetch.mockRestore();
    }
  });
});
