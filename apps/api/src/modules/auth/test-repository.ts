import type {
  AuthRepository,
  AuthUser,
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

// In-memory test adapter only; never wired into the Worker.
export class TestRepository implements AuthRepository {
  user: AuthUser | null = {
    id: '00000000-0000-4000-8000-000000000001',
    fullName: 'Fictional Operator',
    email: 'operator@example.invalid',
    role: 'ops',
    active: true,
    passwordHash: 'current',
  };
  sessions = new Map<string, SessionRecord>();
  attempts: { key: string; createdAt: number }[] = [];
  audits: string[] = [];
  completed: CompleteLogin[] = [];
  touches = 0;
  async reserveAttempt(emailKey: string, ipKey: string, now: Date) {
    this.attempts = this.attempts.filter(
      (entry) => entry.createdAt >= now.getTime() - 86400000,
    );
    const count = (key: string) =>
      this.attempts.filter(
        (entry) =>
          entry.key === key &&
          entry.createdAt >= now.getTime() - LOGIN_WINDOW_MS,
      ).length;
    if (
      count(emailKey) >= EMAIL_ATTEMPT_LIMIT ||
      count(ipKey) >= IP_ATTEMPT_LIMIT
    )
      return false;
    this.attempts.push(
      { key: emailKey, createdAt: now.getTime() },
      { key: ipKey, createdAt: now.getTime() },
    );
    return true;
  }
  async findUser(email: string) {
    return this.user?.email === email ? this.user : null;
  }
  async completeLogin(input: CompleteLogin) {
    if (
      !this.user?.active ||
      this.user.passwordHash !== input.expectedPasswordHash
    )
      return null;
    this.completed.push(input);
    if (input.replacementHash) this.user.passwordHash = input.replacementHash;
    const old = input.oldTokenHash
      ? this.sessions.get(input.oldTokenHash)
      : null;
    if (old) old.revokedAt = input.now;
    const { id, fullName, email, role } = this.user;
    const user = { id, fullName, email, role };
    this.sessions.set(input.tokenHash, {
      id: crypto.randomUUID(),
      user,
      active: true,
      lastSeenAt: input.now,
      expiresAt: input.expiresAt,
      revokedAt: null,
    });
    this.attempts = this.attempts.filter(
      (entry) => entry.key !== input.emailKey,
    );
    this.audits.push('auth.login');
    return user;
  }
  async findSession(hash: string) {
    const session = this.sessions.get(hash);
    return session ? { ...session, active: this.user?.active ?? false } : null;
  }
  async touchSession(id: string, now: Date) {
    const session = [...this.sessions.values()].find((s) => s.id === id);
    if (
      !session ||
      session.revokedAt ||
      session.expiresAt <= now ||
      !this.user?.active ||
      session.lastSeenAt.getTime() + SESSION_IDLE_MS <= now.getTime()
    )
      return false;
    if (now.getTime() - session.lastSeenAt.getTime() >= SESSION_TOUCH_MS) {
      session.lastSeenAt = now;
      this.touches++;
    }
    return true;
  }
  async logout(id: string, now: Date) {
    const session = [...this.sessions.values()].find((s) => s.id === id);
    if (session && !session.revokedAt) {
      session.revokedAt = now;
      this.audits.push('auth.logout');
    }
  }
}
