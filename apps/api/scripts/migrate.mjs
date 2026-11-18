import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { migrate } from 'drizzle-orm/neon-serverless/migrator';
import { fileURLToPath, URL } from 'node:url';
import process from 'node:process';
import { log, error } from 'node:console';
import { loadDatabaseConfig } from './database-env.mjs';

let pool;
try {
  const config = await loadDatabaseConfig();
  log(`Database host: ${config.hostname}`);
  neonConfig.webSocketConstructor = globalThis.WebSocket;
  pool = new Pool({
    connectionString: config.connectionString,
    connectionTimeoutMillis: 10000,
  });
  pool.on('error', () => {
    error('Database connection failed.');
    process.exitCode = 1;
  });
  const client = await pool.connect();
  try {
    await client.query("SET TIME ZONE 'UTC'");
    await migrate(drizzle(client), {
      migrationsFolder: fileURLToPath(new URL('../drizzle/', import.meta.url)),
    });
    log('Migrations applied successfully.');
  } finally {
    client.release();
  }
} catch {
  // Driver errors can contain credentials or query parameters. Never log them.
  error(
    'Migration failed. Check DATABASE_URL, connectivity and the reviewed migration SQL.',
  );
  process.exitCode = 1;
} finally {
  if (pool)
    await pool.end().catch(() => {
      process.exitCode = 1;
    });
}
