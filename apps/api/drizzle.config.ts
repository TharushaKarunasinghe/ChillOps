import { defineConfig } from 'drizzle-kit';

// Generation is offline. Only the explicit migration script loads credentials.
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './drizzle',
});
