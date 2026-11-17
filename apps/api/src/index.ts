import { Hono } from 'hono';
import { cors } from 'hono/cors';

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
