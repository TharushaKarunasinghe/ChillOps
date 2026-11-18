import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, URL } from 'node:url';
import process from 'node:process';
import { log } from 'node:console';

const root = new URL('../', import.meta.url);
if (!existsSync(new URL('apps/web/dist/', root))) {
  log('Web assets are missing; building once for Wrangler dev.');
  const pnpmPath = process.env.npm_execpath;
  if (!pnpmPath) throw new Error('Run this helper through pnpm dev.');
  // pnpm may be a standalone executable or a JavaScript CLI installation.
  const isScript = /\.[cm]?js$/i.test(pnpmPath);
  const result = spawnSync(
    isScript ? process.execPath : pnpmPath,
    [...(isScript ? [pnpmPath] : []), '--filter', '@chillops/web', 'build'],
    { cwd: fileURLToPath(root), stdio: 'inherit' },
  );
  if (result.error || result.status !== 0) process.exit(result.status || 1);
}
