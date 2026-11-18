import process from 'node:process';
import { createInterface } from 'node:readline/promises';
import { emitKeypressEvents } from 'node:readline';
import { log, error } from 'node:console';
import { neon } from '@neondatabase/serverless';
import { createUserSchema, USER_ROLES } from '@chillops/shared/auth';
import { createPasswordHasher } from '../src/modules/auth/password.ts';
import { loadDatabaseConfig } from './database-env.mjs';

async function hiddenPassword() {
  process.stdout.write('Password (hidden, 12 to 128 characters): ');
  emitKeypressEvents(process.stdin);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  return new Promise((resolve, reject) => {
    let password = '';
    function finish(failure) {
      process.stdin.removeListener('keypress', keypress);
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdout.write('\n');
      if (failure) reject(new Error('Cancelled.'));
      else resolve(password);
      password = '';
    }
    function keypress(text, key) {
      if (key?.ctrl && key.name === 'c') return finish(true);
      if (key?.name === 'return' || key?.name === 'enter') return finish(false);
      if (key?.name === 'backspace') {
        password = [...password].slice(0, -1).join('');
        return;
      }
      if (
        !key?.ctrl &&
        !key?.meta &&
        text &&
        [...text].every(
          (char) => char.codePointAt(0) >= 32 && char.codePointAt(0) !== 127,
        )
      )
        password += text;
    }
    process.stdin.on('keypress', keypress);
  });
}

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
