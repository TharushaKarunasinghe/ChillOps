import type { Hono } from 'hono';
import { loginSchema, logoutSchema } from '@chillops/shared/auth';
import type { AuthEnv } from './middleware.ts';
import { BAD_CREDENTIALS } from './service.ts';
import { readSessionToken, sessionCookie, validIp } from './session.ts';

export function registerAuthRoutes(app: Hono<AuthEnv>) {
  app.post('/api/auth/login', async (context) => {
    const parsed = loginSchema.safeParse(
      await context.req.json().catch(() => null),
    );
    if (!parsed.success) return context.json({ error: BAD_CREDENTIALS }, 400);
    const { user, token } = await context.get('auth').login({
      ...parsed.data,
      ip: validIp(context.req.header('CF-Connecting-IP') ?? null),
      userAgent: context.req.header('User-Agent')?.slice(0, 1024) ?? null,
      oldToken: readSessionToken(context.req.raw),
    });
    context.header('Set-Cookie', sessionCookie(context.req.url, token));
    return context.json({ user });
  });
  app.post('/api/auth/logout', async (context) => {
    const parsed = logoutSchema.safeParse(
      await context.req.json().catch(() => null),
    );
    if (!parsed.success) return context.json({ error: 'Invalid request' }, 400);
    await context.get('auth').logout(context.get('session'));
    context.header('Set-Cookie', sessionCookie(context.req.url, null));
    return context.json({ ok: true });
  });
  app.get('/api/auth/me', (context) =>
    context.json({ user: context.get('session').user }),
  );
}
