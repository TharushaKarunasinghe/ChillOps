import type { MiddlewareHandler } from 'hono';
import type { UserRole } from '@chillops/shared/auth';
import type { AuthService } from './service.ts';
import type { SessionRecord } from './repository.ts';
import { readSessionToken } from './session.ts';

export type AuthEnv = {
  Bindings: { DATABASE_URL?: string };
  Variables: { auth: AuthService; session: SessionRecord };
};

export const checkOrigin: MiddlewareHandler<AuthEnv> = async (
  context,
  next,
) => {
  if (
    context.req.method !== 'GET' &&
    context.req.header('Origin') !== new URL(context.req.url).origin
  ) {
    return context.json({ error: 'Request origin is not allowed' }, 403);
  }
  await next();
};

export const authenticate: MiddlewareHandler<AuthEnv> = async (
  context,
  next,
) => {
  const isPublic =
    (context.req.method === 'GET' && context.req.path === '/api/health') ||
    (context.req.method === 'POST' && context.req.path === '/api/auth/login');
  if (isPublic) return next();
  const token = readSessionToken(context.req.raw);
  if (!token) return context.json({ error: 'Authentication required' }, 401);
  const session = await context.get('auth').authenticate(token);
  if (!session) return context.json({ error: 'Authentication required' }, 401);
  context.set('session', session);
  await next();
};

export function requireRole(...roles: UserRole[]): MiddlewareHandler<AuthEnv> {
  return async (context, next) => {
    const session = context.get('session');
    if (!session)
      return context.json({ error: 'Authentication required' }, 401);
    if (!roles.includes(session.user.role))
      return context.json({ error: 'Forbidden' }, 403);
    await next();
  };
}
