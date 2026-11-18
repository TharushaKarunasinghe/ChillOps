import { readFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { URL } from 'node:url';
import process from 'node:process';

export async function loadDatabaseConfig({
  env = process.env,
  varsFile = new URL('../.dev.vars', import.meta.url),
} = {}) {
  let connectionString = env.DATABASE_URL;
  if (connectionString === undefined) {
    try {
      connectionString = parseEnv(
        await readFile(varsFile, 'utf8'),
      ).DATABASE_URL;
    } catch (error) {
      if (error.code !== 'ENOENT')
        throw new Error('Cannot read the local database configuration.');
    }
  }
  if (!connectionString?.trim())
    throw new Error(
      'Set DATABASE_URL in apps/api/.dev.vars or the environment.',
    );
  try {
    const parsed = new URL(connectionString);
    if (
      !['postgres:', 'postgresql:'].includes(parsed.protocol) ||
      !parsed.hostname
    )
      throw new Error();
    return { connectionString, hostname: parsed.hostname };
  } catch {
    throw new Error('DATABASE_URL must be a valid PostgreSQL URL.');
  }
}
