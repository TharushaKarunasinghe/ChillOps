import process from 'node:process';
import { error } from 'node:console';
import {
  validateArguments,
  configuration,
  connect,
  resetSeed,
} from './seed-support.mjs';

try {
  validateArguments(process.argv.slice(2), true);
  const config = await configuration(true);
  await connect(config, resetSeed);
} catch {
  error(
    'Reset failed or cancelled. Require --allow-append-only-bypass, matching hostname, enabled guards and no unrelated foreign-key references. The transaction is rolled back on failure.',
  );
  process.exitCode = 1;
}
