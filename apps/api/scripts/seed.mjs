import process from 'node:process';
import { error } from 'node:console';
import { generateSeed } from '../src/seed/data.ts';
import { createPasswordHasher } from '../src/modules/auth/password.ts';
import { hiddenPassword } from './terminal-input.mjs';
import {
  validateArguments,
  configuration,
  demoPassword,
  connect,
  insertSeed,
} from './seed-support.mjs';

try {
  validateArguments(process.argv.slice(2));
  const config = await configuration(true);
  const password = await demoPassword(hiddenPassword);
  const data = generateSeed();
  await connect(config, (client) =>
    insertSeed(client, data, password, createPasswordHasher().hash),
  );
} catch {
  error(
    'Seed failed or cancelled. Check confirmation, matching valid passwords, configuration and migrations. No partial seed is committed.',
  );
  process.exitCode = 1;
}
