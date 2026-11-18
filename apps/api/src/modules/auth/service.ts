import type { PublicUser } from '@chillops/shared/auth';
import { DUMMY_PASSWORD_HASH, type PasswordHasher } from './password.ts';
import type { AuthRepository, SessionRecord } from './repository.ts';
import {
  newSessionToken,
  SESSION_ABSOLUTE_MS,
  SESSION_TOUCH_MS,
  sessionIsValid,
  sha256,
} from './session.ts';

export const BAD_CREDENTIALS = 'Email or password is incorrect';
export class AuthError extends Error {
  status: 401 | 429;
  constructor(status: 401 | 429, message: string) {
    super(message);
    this.status = status;
  }
}
export class AuthService {
  private repository: AuthRepository;
  private passwords: PasswordHasher;
  private clock: () => Date;
  constructor(
    repository: AuthRepository,
    passwords: PasswordHasher,
    clock: () => Date = () => new Date(),
  ) {
    this.repository = repository;
    this.passwords = passwords;
    this.clock = clock;
  }

  async login(input: {
    email: string;
    password: string;
    ip: string | null;
    userAgent: string | null;
    oldToken: string | null;
  }): Promise<{ user: PublicUser; token: string }> {
    const emailKey = `email:${await sha256(input.email)}`;
    const ipKey = `ip:${await sha256(input.ip ?? 'missing')}`;
    if (!(await this.repository.reserveAttempt(emailKey, ipKey, this.clock())))
      throw new AuthError(429, 'Too many login attempts. Try again later.');
    const user = await this.repository.findUser(input.email);
    const verified = await this.passwords.verify(
      input.password,
      user?.passwordHash ?? DUMMY_PASSWORD_HASH,
    );
    if (!user || !verified || !user.active)
      throw new AuthError(401, BAD_CREDENTIALS);
    const replacementHash = this.passwords.needsRehash(user.passwordHash)
      ? await this.passwords.hash(input.password)
      : null;
    const { token, tokenHash } = await newSessionToken();
    const now = this.clock();
    const publicUser = await this.repository.completeLogin({
      userId: user.id,
      expectedPasswordHash: user.passwordHash,
      replacementHash,
      tokenHash,
      oldTokenHash: input.oldToken ? await sha256(input.oldToken) : null,
      emailKey,
      now,
      expiresAt: new Date(now.getTime() + SESSION_ABSOLUTE_MS),
      ip: input.ip,
      userAgent: input.userAgent,
    });
    if (!publicUser) throw new AuthError(401, BAD_CREDENTIALS);
    return { user: publicUser, token };
  }

  async authenticate(token: string | null): Promise<SessionRecord | null> {
    if (!token) return null;
    const session = await this.repository.findSession(await sha256(token));
    const now = this.clock();
    if (!session || !sessionIsValid(session, now)) return null;
    if (
      now.getTime() - session.lastSeenAt.getTime() >= SESSION_TOUCH_MS &&
      !(await this.repository.touchSession(session.id, now))
    )
      return null;
    return session;
  }
  async logout(session: SessionRecord) {
    await this.repository.logout(session.id, this.clock());
  }
}
