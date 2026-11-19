import process from 'node:process';
import { createInterface } from 'node:readline/promises';
import { hiddenPassword } from './terminal-input.mjs';
import { log, error } from 'node:console';
import { neon } from '@neondatabase/serverless';
import { createUserSchema, USER_ROLES } from '@chillops/shared/auth';
import { createPasswordHasher } from '../src/modules/auth/password.ts';
import { loadDatabaseConfig } from './database-env.mjs';

try {
  if (
    process.argv.length !== 2 ||
    !process.stdin.isTTY ||
    !process.stdout.isTTY
  )
    throw new Error('Interactive terminal required.');
  const config = await loadDatabaseConfig();
  log(`Database host: ${config.hostname}`);
  const prompt = createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  let fullName, email, role;
  try {
    fullName = await prompt.question('Full name (synthetic): ');
    email = await prompt.question('Email: ');
    role = await prompt.question(`Role (${USER_ROLES.join(', ')}): `);
  } finally {
    prompt.close();
  }
  const password = await hiddenPassword();
  const user = createUserSchema.safeParse({ fullName, email, role, password });
  if (!user.success) throw new Error('Invalid input.');
  const passwordHash = await createPasswordHasher().hash(user.data.password);
  const query = neon(config.connectionString);
  await query`insert into users (full_name, email, role, password_hash) values (${user.data.fullName}, ${user.data.email}, ${user.data.role}, ${passwordHash})`;
  log(user.data.email);
} catch {
  error(
    'User creation failed or cancelled. Use an interactive terminal with no arguments; check the fields, DATABASE_URL and migrations.',
  );
  process.exitCode = 1;
}
