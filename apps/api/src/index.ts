import { APP_NAME } from '@chillops/shared';
import { Hono } from 'hono';
import { cors } from 'hono/cors';

export const applicationName = APP_NAME;

const app = new Hono<{ Bindings: { WEB_ORIGIN?: string } }>();

app.use(
  '/health',
  cors({
    origin: (origin, context) => {
      const allowedOrigin = context.env?.WEB_ORIGIN;
      return allowedOrigin && allowedOrigin !== '*' && origin === allowedOrigin
        ? origin
        : undefined;
    },
    allowMethods: ['GET', 'OPTIONS'],
  }),
);

app.get('/health', (context) => context.json({ status: 'ok' }));

export default app;
