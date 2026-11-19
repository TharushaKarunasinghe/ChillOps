import process from 'node:process';
import { log, error } from 'node:console';
import { TABLES, SEED_IDS, COUNTS } from '../src/seed/data.ts';
import { validateArguments, configuration, connect } from './seed-support.mjs';

try {
  validateArguments(process.argv.slice(2));
  const config = await configuration();
  let failed = false;
  const report = (name, ok) => {
    log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
    failed ||= !ok;
  };
  await connect(
    config,
    async (client) => {
      for (const table of [
        ...TABLES,
        'sessions',
        'login_attempts',
        'audit_log',
      ]) {
        const result = await client.query(
          `SELECT count(*)::int AS count FROM ${table}`,
        );
        log(`${table}: ${result.rows[0].count}`);
        if (TABLES.includes(table)) {
          const seeded = await client.query(
            `SELECT count(*)::int AS count FROM ${table} WHERE id = ANY($1::uuid[])`,
            [SEED_IDS[table]],
          );
          report(
            `${table} seed count ${seeded.rows[0].count}/${COUNTS[table]}`,
            seeded.rows[0].count === COUNTS[table],
          );
        }
      }
      const check = async (name, sql, params = []) => {
        const result = await client.query(sql, params);
        report(name, result.rows[0].ok === true);
      };
      await check(
        'Every job has a history matching its current status',
        `SELECT NOT EXISTS (
      SELECT 1 FROM jobs j LEFT JOIN LATERAL
      (SELECT to_status FROM job_events WHERE job_id = j.id ORDER BY occurred_at DESC, created_at DESC, id DESC LIMIT 1) e ON true
      WHERE e.to_status IS DISTINCT FROM j.current_status) AS ok`,
      );
      await check(
        'Every history starts at unassigned and follows valid transitions',
        `WITH ordered AS (
      SELECT *, row_number() OVER w AS n, lag(to_status) OVER w AS previous
      FROM job_events WINDOW w AS (PARTITION BY job_id ORDER BY occurred_at, created_at, id)
    ) SELECT NOT EXISTS (SELECT 1 FROM ordered WHERE
      (n = 1 AND (from_status IS NOT NULL OR to_status <> 'unassigned')) OR
      (n > 1 AND (from_status IS DISTINCT FROM previous OR NOT (
        (from_status = 'unassigned' AND to_status = 'assigned') OR
        (from_status = 'assigned' AND to_status = 'in_transit') OR
        (from_status = 'in_transit' AND to_status = 'on_site') OR
        (from_status = 'on_site' AND to_status IN ('completed', 'pending')) OR
        (from_status = 'pending' AND to_status = 'assigned'))))) AS ok`,
      );
      await check(
        'Event times are strictly increasing in recorded creation order',
        `WITH ordered AS (
      SELECT e.*, lag(occurred_at) OVER (PARTITION BY job_id ORDER BY created_at, id) AS previous FROM job_events e
    ) SELECT NOT EXISTS (SELECT 1 FROM ordered e JOIN jobs j ON j.id = e.job_id
      WHERE e.occurred_at < j.reported_at OR e.occurred_at <= e.previous) AS ok`,
      );
      await check(
        'Seed event times follow manifest order',
        `WITH ordered AS (
      SELECT occurred_at, lag(occurred_at) OVER (PARTITION BY job_id ORDER BY array_position($1::uuid[], id)) AS previous
      FROM job_events WHERE id = ANY($1::uuid[])
    ) SELECT NOT EXISTS (SELECT 1 FROM ordered WHERE occurred_at <= previous) AS ok`,
        [SEED_IDS.job_events],
      );
      await check(
        'Seed emails use reserved domains',
        `SELECT NOT EXISTS (
      SELECT 1 FROM users WHERE id = ANY($1::uuid[]) AND email !~ '^[^@]+@chillops[.]test$'
      UNION ALL SELECT 1 FROM customer_contacts WHERE id = ANY($2::uuid[]) AND
      (kind <> 'email' OR address !~ '^[^@]+@[a-z0-9.-]+[.]example$')) AS ok`,
        [SEED_IDS.users, SEED_IDS.customer_contacts],
      );
      await check(
        'Seed coordinates are paired and in the Colombo box',
        `WITH points AS (
      SELECT latitude, longitude FROM branches WHERE id = ANY($1::uuid[])
      UNION ALL SELECT latitude, longitude FROM job_events WHERE id = ANY($2::uuid[])
    ) SELECT NOT EXISTS (SELECT 1 FROM points WHERE
      (latitude IS NULL) <> (longitude IS NULL) OR latitude NOT BETWEEN 6.80 AND 7.25 OR longitude NOT BETWEEN 79.80 AND 80.05) AS ok`,
        [SEED_IDS.branches, SEED_IDS.job_events],
      );
      await check(
        'Seed jobs and events avoid Sundays',
        `SELECT NOT EXISTS (
      SELECT 1 FROM jobs WHERE id = ANY($1::uuid[]) AND extract(dow FROM reported_at AT TIME ZONE 'Asia/Colombo') = 0
      UNION ALL SELECT 1 FROM job_events WHERE id = ANY($2::uuid[]) AND extract(dow FROM occurred_at AT TIME ZONE 'Asia/Colombo') = 0) AS ok`,
        [SEED_IDS.jobs, SEED_IDS.job_events],
      );
    },
    true,
  );
  if (failed) process.exitCode = 1;
} catch {
  error(
    'FAIL Seed check could not complete. Check configuration and migrations.',
  );
  process.exitCode = 1;
}
