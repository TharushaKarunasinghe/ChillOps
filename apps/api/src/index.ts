import { APP_NAME } from '@chillops/shared';
import { Hono } from 'hono';

export const applicationName = APP_NAME;

const app = new Hono();

export default app;
