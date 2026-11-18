import type { PublicUser } from '@chillops/shared/auth';

export interface AuthUser extends PublicUser {
  passwordHash: string;
  active: boolean;
}
export interface SessionRecord {
  id: string;
  user: PublicUser;
  active: boolean;
  lastSeenAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
}
export interface CompleteLogin {
  userId: string;
  expectedPasswordHash: string;
  replacementHash: string | null;
  tokenHash: string;
  oldTokenHash: string | null;
  emailKey: string;
  now: Date;
  expiresAt: Date;
  ip: string | null;
  userAgent: string | null;
}
export interface AuthRepository {
  reserveAttempt(emailKey: string, ipKey: string, now: Date): Promise<boolean>;
  findUser(email: string): Promise<AuthUser | null>;
  completeLogin(input: CompleteLogin): Promise<PublicUser | null>;
  findSession(tokenHash: string): Promise<SessionRecord | null>;
  touchSession(id: string, now: Date): Promise<boolean>;
  logout(id: string, now: Date): Promise<void>;
}
