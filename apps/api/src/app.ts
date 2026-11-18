import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { AuthError, AuthService } from './modules/auth/service.ts';
import { createPasswordHasher } from './modules/auth/password.ts';
import { createAuthRepository } from './modules/auth/neon-repository.ts';
import {
  authenticate,
  checkOrigin,
  type AuthEnv,
} from './modules/auth/middleware.ts';
import { registerAuthRoutes } from './modules/auth/routes.ts';
import { readSessionToken } from './modules/auth/session.ts';

export function createApp(injected?: AuthService) {
  const app = new Hono<AuthEnv>();
  app.use('/api/*', async (context, next) => {
    context.header('Cache-Control', 'no-store');
    await next();
  });
  app.use('/api/*', checkOrigin);
  app.use('/api/*', async (context, next) => {
    // No database construction for public health or unauthenticated requests.
    if (injected) context.set('auth', injected);
    else if (
      context.env?.DATABASE_URL &&
      context.req.path !== '/api/health' &&
      (context.req.path === '/api/auth/login' ||
        readSessionToken(context.req.raw))
    )
      context.set(
        'auth',
        new AuthService(
          createAuthRepository(context.env.DATABASE_URL),
          createPasswordHasher(),
        ),
      );
    await next();
  });
  app.use('/api/*', authenticate);
  app.use(
    '/api/*',
    bodyLimit({
      maxSize: 8192,
      onError: (context) =>
        context.json({ error: 'Request is too large' }, 413),
    }),
  );
  app.get('/api/health', (context) => context.json({ status: 'ok' }));
  registerAuthRoutes(app);
  app.notFound((context) => context.json({ error: 'Not found' }, 404));
  app.onError((error, context) => {
    if (error instanceof AuthError)
      return context.json({ error: error.message }, error.status);
    // Never forward or log driver errors, request bodies, tokens or hashes.
    return context.json(
      { error: 'Authentication service is unavailable. Try again later.' },
      503,
    );
  });
  return app;
}
