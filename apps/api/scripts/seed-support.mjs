import process from 'node:process';
import { log } from 'node:console';
import { createInterface } from 'node:readline/promises';
import { Pool, neonConfig } from '@neondatabase/serverless';
import { TABLES, SEED_IDS } from '../src/seed/data.ts';
import { passwordSchema } from '@chillops/shared/auth';
import { loadDatabaseConfig } from './database-env.mjs';

// Node 24 supplies the browser-compatible constructor; no ws package is needed.
neonConfig.webSocketConstructor = globalThis.WebSocket;

export function validateArguments(args, reset = false) {
  if (
    reset
      ? args.length !== 1 || args[0] !== '--allow-append-only-bypass'
      : args.length !== 0
  )
    throw new Error('Invalid arguments.');
}
export async function confirmHost(hostname, ask) {
  if ((await ask('Type the database hostname to confirm: ')) !== hostname)
    throw new Error('Confirmation did not match.');
}
export async function demoPassword(read) {
  const first = await read('Demo password (hidden, 12 to 128 characters): ');
  const second = await read('Repeat demo password (hidden): ');
  if (first !== second) throw new Error('Passwords do not match.');
  return passwordSchema.parse(first);
}
export async function configuration(write = false) {
  const config = await loadDatabaseConfig();
  log(`Database host: ${config.hostname}`);
  if (write) {
    if (!process.stdin.isTTY || !process.stdout.isTTY)
      throw new Error('Interactive terminal required.');
    const prompt = createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    try {
      await confirmHost(config.hostname, (question) =>
        prompt.question(question),
      );
    } finally {
      prompt.close();
    }
  }
  return config;
}
export async function transaction(client, action, readOnly = false) {
  await client.query(
    readOnly ? 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY' : 'BEGIN',
  );
  try {
    await client.query("SET LOCAL TIME ZONE 'UTC'");
    await client.query("SET LOCAL lock_timeout = '5s'");
    await client.query("SET LOCAL statement_timeout = '30s'");
    const result = await action(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}
export async function connect(config, action, readOnly = false) {
  const pool = new Pool({
    connectionString: config.connectionString,
    connectionTimeoutMillis: 10000,
  });
  // Suppress driver error objects, which can contain private connection details.
  pool.on('error', () => {
    process.exitCode = 1;
  });
  try {
    const client = await pool.connect();
    try {
      return await transaction(client, action, readOnly);
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
}
export async function insertSeed(client, data, password, hash) {
  // Lock out concurrent seed/reset/application writes before reading IDs. In particular,
  // never evaluate a job-number default for an already-existing seed job.
  await client.query(
    `LOCK TABLE ${TABLES.join(', ')} IN SHARE ROW EXCLUSIVE MODE`,
  );
  for (const table of TABLES) {
    const existing = await client.query(
      `SELECT id FROM ${table} WHERE id = ANY($1::uuid[])`,
      [SEED_IDS[table]],
    );
    const ids = new Set(existing.rows.map((row) => row.id));
    const rows = data[table].filter((row) => !ids.has(row.id));
    if (table === 'jobs')
      rows.sort((a, b) => a.reported_at.localeCompare(b.reported_at));
    for (const original of rows) {
      const row = { ...original };
      if (table === 'users') row.password_hash = await hash(password);
      const columns = Object.keys(row);
      await client.query(
        `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${columns.map((_, i) => `$${i + 1}`).join(', ')})`,
        Object.values(row),
      );
    }
  }
}
export async function resetSeed(client) {
  await client.query(
    `LOCK TABLE ${[...TABLES, 'sessions', 'audit_log'].join(', ')} IN ACCESS EXCLUSIVE MODE`,
  );
  const guards = await client.query(
    "SELECT tgname, tgenabled FROM pg_trigger WHERE (tgrelid = 'public.job_events'::regclass AND tgname = 'job_events_append_only') OR (tgrelid = 'public.audit_log'::regclass AND tgname = 'audit_log_append_only')",
  );
  if (
    guards.rows.length !== 2 ||
    guards.rows.some((row) => row.tgenabled !== 'O')
  )
    throw new Error('Expected enabled append-only guards.');
  await client.query(
    'ALTER TABLE job_events DISABLE TRIGGER job_events_append_only',
  );
  await client.query(
    'ALTER TABLE audit_log DISABLE TRIGGER audit_log_append_only',
  );
  await client.query('DELETE FROM audit_log WHERE actor_id = ANY($1::uuid[])', [
    SEED_IDS.users,
  ]);
  await client.query('DELETE FROM sessions WHERE user_id = ANY($1::uuid[])', [
    SEED_IDS.users,
  ]);
  for (const table of [...TABLES].reverse())
    await client.query(`DELETE FROM ${table} WHERE id = ANY($1::uuid[])`, [
      SEED_IDS[table],
    ]);
  await client.query(
    'ALTER TABLE job_events ENABLE TRIGGER job_events_append_only',
  );
  await client.query(
    'ALTER TABLE audit_log ENABLE TRIGGER audit_log_append_only',
  );
}
