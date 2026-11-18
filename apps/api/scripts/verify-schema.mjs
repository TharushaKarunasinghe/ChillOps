import { Pool, neonConfig } from '@neondatabase/serverless';
import { randomUUID } from 'node:crypto';
import process from 'node:process';
import { log, error } from 'node:console';
import { loadDatabaseConfig } from './database-env.mjs';

let pool;
try {
  const config = await loadDatabaseConfig();
  log(`Database host: ${config.hostname}`);
  neonConfig.webSocketConstructor = globalThis.WebSocket;
  pool = new Pool({
    connectionString: config.connectionString,
    connectionTimeoutMillis: 10000,
  });
  pool.on('error', () => {
    error('Database connection failed.');
    process.exitCode = 1;
  });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SET LOCAL TIME ZONE 'UTC'");
    await client.query("SET LOCAL lock_timeout = '5s'");
    await client.query("SET LOCAL statement_timeout = '15s'");

    async function rejected(label, query, values, code, constraint) {
      await client.query('SAVEPOINT expected_rejection');
      let caught;
      try {
        await client.query(query, values);
      } catch (failure) {
        caught = failure;
      }
      await client.query('ROLLBACK TO SAVEPOINT expected_rejection');
      await client.query('RELEASE SAVEPOINT expected_rejection');
      if (
        caught?.code !== code ||
        (constraint && caught.constraint !== constraint)
      ) {
        throw new Error('Expected schema rejection was not observed.');
      }
      log(`PASS: ${label}`);
    }

    const email = `schema-${randomUUID()}@example.invalid`;
    const user = (
      await client.query(
        "INSERT INTO users (full_name, email, password_hash, role) VALUES ('Fictional Schema Tester', $1, 'synthetic-not-a-password', 'ops') RETURNING id",
        [email],
      )
    ).rows[0].id;
    const customer = (
      await client.query(
        "INSERT INTO customers (name) VALUES ('Fictional Frost Market') RETURNING id",
      )
    ).rows[0].id;
    const otherCustomer = (
      await client.query(
        "INSERT INTO customers (name) VALUES ('Fictional Polar Cinema') RETURNING id",
      )
    ).rows[0].id;
    const branch = (
      await client.query(
        "INSERT INTO branches (customer_id, name, address) VALUES ($1, 'Test North', 'Synthetic address') RETURNING id",
        [customer],
      )
    ).rows[0].id;
    const otherBranch = (
      await client.query(
        "INSERT INTO branches (customer_id, name, address) VALUES ($1, 'Test South', 'Synthetic address') RETURNING id",
        [customer],
      )
    ).rows[0].id;
    const equipment = (
      await client.query(
        "INSERT INTO equipment (branch_id, type, label) VALUES ($1, 'refrigeration', 'Fictional freezer') RETURNING id",
        [otherBranch],
      )
    ).rows[0].id;
    const insertJob =
      "INSERT INTO jobs (customer_id, branch_id, equipment_id, job_type, priority, description, source, created_by) VALUES ($1, $2, $3, 'breakdown', 'routine', 'Synthetic verification job', $4, $5) RETURNING id, job_number";
    const job = (
      await client.query(insertJob, [customer, branch, null, 'manual', user])
    ).rows[0];
    if (
      !/^JOB-[1-9]\d*$/.test(job.job_number) ||
      BigInt(job.job_number.slice(4)) < 1001n
    )
      throw new Error('Invalid generated job number.');
    log('PASS: database-generated JOB-1001-style job number');
    await rejected(
      'job branch belongs to customer',
      insertJob,
      [otherCustomer, branch, null, 'manual', user],
      '23503',
      'jobs_branch_customer_fk',
    );
    await rejected(
      'equipment belongs to job branch',
      insertJob,
      [customer, branch, equipment, 'manual', user],
      '23503',
      'jobs_equipment_branch_fk',
    );
    await rejected(
      'manual jobs require an actor',
      insertJob,
      [customer, branch, null, 'manual', null],
      '23514',
      'jobs_manual_actor_required',
    );
    await client.query(insertJob, [customer, branch, null, 'email', null]);
    log('PASS: system actor allowed for email jobs');
    await rejected(
      'case-insensitive unique user email',
      "INSERT INTO users (full_name, email, password_hash, role) VALUES ('Fictional Duplicate', $1, 'synthetic', 'ops')",
      [email.toUpperCase()],
      '23505',
      'users_email_unique',
    );
    await rejected(
      'branch coordinates must be paired',
      'UPDATE branches SET latitude = 6 WHERE id = $1',
      [branch],
      '23514',
      'branches_coordinates_paired',
    );
    await rejected(
      'contact branch belongs to customer',
      "INSERT INTO customer_contacts (customer_id, branch_id, kind, address) VALUES ($1, $2, 'email', 'synthetic@example.invalid')",
      [otherCustomer, branch],
      '23503',
      'contacts_branch_customer_fk',
    );
    await rejected(
      'event coordinates must be paired',
      "INSERT INTO job_events (job_id, to_status, latitude) VALUES ($1, 'unassigned', 6)",
      [job.id],
      '23514',
      'job_events_coordinates_paired',
    );
    const event = (
      await client.query(
        "INSERT INTO job_events (job_id, to_status) VALUES ($1, 'unassigned') RETURNING id",
        [job.id],
      )
    ).rows[0].id;
    await rejected(
      'job_events rejects UPDATE',
      "UPDATE job_events SET note = 'Changed' WHERE id = $1",
      [event],
      '55000',
    );
    await rejected(
      'job_events rejects DELETE',
      'DELETE FROM job_events WHERE id = $1',
      [event],
      '55000',
    );
    await rejected(
      'job_events rejects TRUNCATE',
      'TRUNCATE TABLE job_events',
      [],
      '55000',
    );
    const audit = (
      await client.query(
        "INSERT INTO audit_log (actor_id, action, entity_type, entity_id) VALUES ($1, 'synthetic_verification', 'job', $2) RETURNING id",
        [user, job.id],
      )
    ).rows[0].id;
    await rejected(
      'audit_log rejects UPDATE',
      "UPDATE audit_log SET action = 'Changed' WHERE id = $1",
      [audit],
      '55000',
    );
    await rejected(
      'audit_log rejects DELETE',
      'DELETE FROM audit_log WHERE id = $1',
      [audit],
      '55000',
    );
    await rejected(
      'audit_log rejects TRUNCATE',
      'TRUNCATE TABLE audit_log',
      [],
      '55000',
    );
  } finally {
    try {
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  }
  log(
    'Schema verification passed; all fixture rows rolled back. Sequence values are not rolled back.',
  );
} catch {
  error(
    'Schema verification failed. Check configuration, connectivity and that all migrations were applied. No driver details are logged.',
  );
  process.exitCode = 1;
} finally {
  if (pool)
    await pool.end().catch(() => {
      process.exitCode = 1;
    });
}
