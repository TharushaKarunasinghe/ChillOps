import process from 'node:process';
import { log, error } from 'node:console';
import { Pool, neonConfig } from '@neondatabase/serverless';
import { PgDialect } from 'drizzle-orm/pg-core';
import { createJobStatement } from '../src/modules/jobs/create-statement.ts';
import { generateSeed, SEED_IDS } from '../src/seed/data.ts';
import { configuration, validateArguments } from './seed-support.mjs';

let pool;
try {
  validateArguments(process.argv.slice(2));
  const config = await configuration(true);
  neonConfig.webSocketConstructor = globalThis.WebSocket;
  pool = new Pool({
    connectionString: config.connectionString,
    connectionTimeoutMillis: 10000,
  });
  pool.on('error', () => {
    process.exitCode = 1;
  });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SET LOCAL TIME ZONE 'UTC'");
    await client.query("SET LOCAL lock_timeout = '5s'");
    await client.query("SET LOCAL statement_timeout = '15s'");
    await client.query(
      'LOCK TABLE jobs, job_events, audit_log IN SHARE ROW EXCLUSIVE MODE',
    );
    const fixture = generateSeed(new Date('2026-11-20T10:00:00Z'));
    const branch = fixture.branches[0];
    const item = fixture.equipment.find((e) => e.branch_id === branch.id);
    const otherItem = fixture.equipment.find((e) => e.branch_id !== branch.id);
    const input = {
      customer_id: branch.customer_id,
      branch_id: branch.id,
      equipment_id: item.id,
      job_type: 'breakdown',
      priority: 'urgent',
      description: 'Synthetic rollback-only job verification',
    };
    const dialect = new PgDialect();
    async function create(body) {
      const query = dialect.sqlToQuery(
        createJobStatement(body, SEED_IDS.users[0]),
      );
      return (await client.query(query.sql, query.params)).rows[0];
    }
    async function counts() {
      return (
        await client.query(
          'SELECT (SELECT count(*) FROM jobs)::int AS jobs, (SELECT count(*) FROM job_events)::int AS events, (SELECT count(*) FROM audit_log)::int AS audits',
        )
      ).rows[0];
    }
    function check(label, ok) {
      log(`${ok ? 'PASS' : 'FAIL'} ${label}`);
      if (!ok) throw new Error('Verification failed.');
    }
    const before = await counts();
    const valid = await create(input);
    const after = await counts();
    check(
      'Valid create inserts one job, one event and one audit',
      valid.error_field === null &&
        after.jobs === before.jobs + 1 &&
        after.events === before.events + 1 &&
        after.audits === before.audits + 1,
    );
    check(
      'Initial event has null from_status and the caller actor',
      valid.initial_event.from_status === null &&
        valid.initial_event.to_status === 'unassigned' &&
        valid.initial_event.actor_id === SEED_IDS.users[0] &&
        valid.initial_event.job_id === valid.job.id,
    );
    const audit = (
      await client.query(
        'SELECT actor_id,action,entity_type,entity_id FROM audit_log WHERE id=$1',
        [valid.audit_id],
      )
    ).rows[0];
    check(
      'Audit belongs to the created job and caller',
      audit.actor_id === SEED_IDS.users[0] &&
        audit.action === 'job.create' &&
        audit.entity_type === 'job' &&
        audit.entity_id === valid.job.id,
    );
    check(
      'Database generates a JOB- number',
      /^JOB-[1-9]\d*$/.test(valid.job.job_number),
    );
    const wrongCustomer = await create({
      ...input,
      customer_id: SEED_IDS.customers[1],
    });
    check(
      'Wrong customer returns branch_id and inserts nothing',
      wrongCustomer.error_field === 'branch_id' &&
        wrongCustomer.job === null &&
        wrongCustomer.initial_event === null &&
        wrongCustomer.audit_id === null &&
        JSON.stringify(await counts()) === JSON.stringify(after),
    );
    const wrongEquipment = await create({
      ...input,
      equipment_id: otherItem.id,
    });
    check(
      'Wrong branch equipment returns equipment_id and inserts nothing',
      wrongEquipment.error_field === 'equipment_id' &&
        wrongEquipment.job === null &&
        wrongEquipment.initial_event === null &&
        wrongEquipment.audit_id === null &&
        JSON.stringify(await counts()) === JSON.stringify(after),
    );
  } finally {
    try {
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  }
  log('PASS Verification transaction rolled back');
} catch {
  error(
    'FAIL Jobs verification could not complete. Check hostname confirmation, connectivity, migrations and seeded fixtures.',
  );
  process.exitCode = 1;
} finally {
  if (pool)
    await pool.end().catch(() => {
      process.exitCode = 1;
    });
}
