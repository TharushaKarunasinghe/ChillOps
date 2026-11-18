import { sql } from 'drizzle-orm';
import type { PublicUser } from '@chillops/shared/auth';
import { createDatabase } from '../../db/client';
import { users } from '../../db/schema';
import type {
  AuthRepository,
  CompleteLogin,
  SessionRecord,
} from './repository.ts';
import {
  EMAIL_ATTEMPT_LIMIT,
  IP_ATTEMPT_LIMIT,
  LOGIN_WINDOW_MS,
  SESSION_IDLE_MS,
  SESSION_TOUCH_MS,
} from './session.ts';

// All attempt reservations and successful-login resets use this same xact lock.
// Lock acquisition MUST be a separate statement before the count/insert, so
// READ COMMITTED takes a fresh snapshot after any competing transaction commits.
const attemptLock = sql`select pg_advisory_xact_lock(hashtextextended('chillops:login-attempts', 0))`;

export function createAuthRepository(databaseUrl: string): AuthRepository {
  const db = createDatabase(databaseUrl);
  return {
    async reserveAttempt(emailKey, ipKey, now) {
      const results = await db.batch([
        db.execute(sql`set transaction isolation level read committed`),
        db.execute(attemptLock),
        db.execute(
          sql`delete from login_attempts where created_at < ${new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()}::timestamptz`,
        ),
        db.execute(sql`
          insert into login_attempts (key, created_at)
          select candidate.key, ${now.toISOString()}::timestamptz
          from (values (${emailKey}), (${ipKey})) as candidate(key)
          where (select count(*) from login_attempts where key = ${emailKey}
            and created_at >= ${new Date(now.getTime() - LOGIN_WINDOW_MS).toISOString()}::timestamptz) < ${EMAIL_ATTEMPT_LIMIT}
          and (select count(*) from login_attempts where key = ${ipKey}
            and created_at >= ${new Date(now.getTime() - LOGIN_WINDOW_MS).toISOString()}::timestamptz) < ${IP_ATTEMPT_LIMIT}
          returning key
        `),
      ]);
      return results[3].rows.length === 2;
    },
    async findUser(email) {
      const [user] = await db
        .select()
        .from(users)
        .where(sql`lower(${users.email}) = ${email}`)
        .limit(1);
      return user ?? null;
    },
    async completeLogin(input: CompleteLogin) {
      const results = await db.batch([
        db.execute(sql`set transaction isolation level read committed`),
        db.execute(attemptLock),
        db.execute(sql`
          with eligible as materialized (
            select id, full_name, email, role from users
            where id = ${input.userId}::uuid and active
              and password_hash = ${input.expectedPasswordHash} for update
          ), upgraded as (
            update users set password_hash = ${input.replacementHash}
            where id in (select id from eligible) and ${input.replacementHash}::text is not null
          ), created as (
            insert into sessions (user_id, token_hash, created_at, last_seen_at, expires_at, ip, user_agent)
            select id, ${input.tokenHash}, ${input.now.toISOString()}::timestamptz,
              ${input.now.toISOString()}::timestamptz, ${input.expiresAt.toISOString()}::timestamptz,
              ${input.ip}::inet, ${input.userAgent} from eligible
            returning id, user_id
          ), rotated as (
            update sessions set revoked_at = ${input.now.toISOString()}::timestamptz
            where token_hash = ${input.oldTokenHash} and revoked_at is null
              and exists (select 1 from created)
          ), cleared as (
            delete from login_attempts where key = ${input.emailKey}
              and exists (select 1 from created)
          ), audited as (
            insert into audit_log (actor_id, action, entity_type, entity_id)
            select user_id, 'auth.login', 'session', id from created
          )
          select eligible.id, eligible.full_name as "fullName", eligible.email, eligible.role
          from eligible join created on created.user_id = eligible.id
        `),
      ]);
      return (results[2].rows[0] as PublicUser | undefined) ?? null;
    },
    async findSession(tokenHash) {
      const result = await db.execute(sql`
        select s.id, s.last_seen_at as "lastSeenAt", s.expires_at as "expiresAt", s.revoked_at as "revokedAt",
          u.active, json_build_object('id', u.id, 'fullName', u.full_name, 'email', u.email, 'role', u.role) as "user"
        from sessions s join users u on u.id = s.user_id where s.token_hash = ${tokenHash}
      `);
      const row = result.rows[0];
      if (!row) return null;
      return {
        ...row,
        lastSeenAt: new Date(String(row.lastSeenAt)),
        expiresAt: new Date(String(row.expiresAt)),
        revokedAt: row.revokedAt ? new Date(String(row.revokedAt)) : null,
      } as SessionRecord;
    },
    async touchSession(id, now) {
      const result = await db.execute(sql`
        with valid as materialized (
          select s.id from sessions s join users u on u.id = s.user_id
          where s.id = ${id}::uuid and u.active and s.revoked_at is null
            and s.expires_at > ${now.toISOString()}::timestamptz
            and s.last_seen_at > ${new Date(now.getTime() - SESSION_IDLE_MS).toISOString()}::timestamptz
          for update of s
        ), touched as (
          update sessions set last_seen_at = ${now.toISOString()}::timestamptz
          where id in (select id from valid)
            and last_seen_at <= ${new Date(now.getTime() - SESSION_TOUCH_MS).toISOString()}::timestamptz
        ) select id from valid
      `);
      return result.rows.length === 1;
    },
    async logout(id, now) {
      await db.execute(sql`
        with revoked as (
          update sessions set revoked_at = ${now.toISOString()}::timestamptz
          where id = ${id}::uuid and revoked_at is null returning id, user_id
        ) insert into audit_log (actor_id, action, entity_type, entity_id)
          select user_id, 'auth.logout', 'session', id from revoked
      `);
    },
  };
}
