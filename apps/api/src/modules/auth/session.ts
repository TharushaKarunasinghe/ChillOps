import { ipSchema } from '@chillops/shared/auth';
import { base64url } from './password.ts';

export const SESSION_IDLE_MS = 12 * 60 * 60 * 1000;
export const SESSION_ABSOLUTE_MS = 7 * 24 * 60 * 60 * 1000;
export const SESSION_TOUCH_MS = 5 * 60 * 1000;
export const LOGIN_WINDOW_MS = 15 * 60 * 1000;
export const EMAIL_ATTEMPT_LIMIT = 5;
export const IP_ATTEMPT_LIMIT = 20;

export async function sha256(value: string) {
  const bytes = new Uint8Array(
    await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)),
  );
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
export async function newSessionToken() {
  const token = base64url(crypto.getRandomValues(new Uint8Array(32)));
  return { token, tokenHash: await sha256(token) };
}
export function cookieName(url: string) {
  const parsed = new URL(url);
  return parsed.protocol === 'http:' && parsed.hostname === 'localhost'
    ? 'session'
    : '__Host-session';
}
export function readSessionToken(request: Request) {
  const name = cookieName(request.url);
  const matches = (request.headers.get('Cookie') ?? '')
    .split(';')
    .map((part) => part.trim())
    .filter((part) => part.startsWith(`${name}=`));
  if (matches.length !== 1) return null;
  const value = matches[0]!.slice(name.length + 1);
  return /^[A-Za-z0-9_-]{43}$/.test(value) ? value : null;
}
export function sessionCookie(url: string, token: string | null) {
  return `${cookieName(url)}=${token ?? ''}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${token ? SESSION_ABSOLUTE_MS / 1000 : 0}`;
}
export function validIp(value: string | null) {
  const parsed = ipSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
export function sessionIsValid(
  session: {
    revokedAt: Date | null;
    expiresAt: Date;
    lastSeenAt: Date;
    active: boolean;
  },
  now: Date,
) {
  return (
    session.active &&
    session.revokedAt === null &&
    session.expiresAt > now &&
    session.lastSeenAt.getTime() + SESSION_IDLE_MS > now.getTime()
  );
}
