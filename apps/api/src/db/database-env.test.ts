import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, unlinkSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';

const loader = new URL('../../scripts/database-env.mjs', import.meta.url).href;

function inspectConfig(env: Record<string, string>, varsFile: string) {
  // Only synthetic configuration is supplied. No real local configuration is read.
  const script = `
    import { loadDatabaseConfig } from ${JSON.stringify(loader)};
    try {
      const config = await loadDatabaseConfig({env: ${JSON.stringify(env)}, varsFile: new URL(${JSON.stringify(varsFile)})});
      console.log(JSON.stringify({hostname: config.hostname}));
    } catch (error) {
      console.log(JSON.stringify({error: error.message}));
    }
  `;
  return JSON.parse(
    execFileSync(process.execPath, ['--input-type=module', '-e', script], {
      encoding: 'utf8',
    }),
  ) as { hostname?: string; error?: string };
}

describe('private database configuration', () => {
  it('loads a quoted local value and lets the environment take precedence', () => {
    const directory = mkdtempSync(join(tmpdir(), 'chillops-env-'));
    const file = join(directory, '.dev.vars');
    try {
      writeFileSync(
        file,
        'WEB_ORIGIN=http://localhost:5173\nDATABASE_URL="postgresql://synthetic:private@file.example.invalid/db"\n',
      );
      const varsFile = pathToFileURL(file).href;
      expect(inspectConfig({}, varsFile)).toEqual({
        hostname: 'file.example.invalid',
      });
      expect(
        inspectConfig(
          {
            DATABASE_URL:
              'postgresql://synthetic:private@env.example.invalid/db',
          },
          varsFile,
        ),
      ).toEqual({ hostname: 'env.example.invalid' });
      expect(inspectConfig({ DATABASE_URL: '' }, varsFile).error).toMatch(
        /^Set DATABASE_URL/,
      );
    } finally {
      unlinkSync(file);
      rmdirSync(directory);
    }
  });

  it('reports missing or invalid configuration without exposing credentials', () => {
    const missing = new URL('missing-synthetic-config', import.meta.url).href;
    expect(inspectConfig({}, missing).error).toMatch(/^Set DATABASE_URL/);
    for (const value of [
      'not-a-url-private-password',
      'https://synthetic:private@example.invalid/db',
    ]) {
      expect(inspectConfig({ DATABASE_URL: value }, missing)).toEqual({
        error: 'DATABASE_URL must be a valid PostgreSQL URL.',
      });
    }
  });
});
