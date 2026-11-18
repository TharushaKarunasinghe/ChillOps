import { performance } from 'node:perf_hooks';
import { timingSafeEqual } from 'node:crypto';
import { log } from 'node:console';
import { AuthService } from '../src/modules/auth/service.ts';
import {
  createPasswordHasher,
  PASSWORD_ITERATIONS,
} from '../src/modules/auth/password.ts';

const hasher = createPasswordHasher(timingSafeEqual);
const durations = [];
for (let i = 0; i < 20; i++) {
  const start = performance.now();
  await hasher.hash('synthetic benchmark password');
  durations.push(performance.now() - start);
}
const unavailable = async () => {
  throw new Error('Unexpected repository operation.');
};
const service = new AuthService(
  {
    reserveAttempt: async () => true,
    findUser: async () => null,
    completeLogin: unavailable,
    findSession: unavailable,
    touchSession: unavailable,
    logout: unavailable,
  },
  hasher,
);
const start = performance.now();
try {
  await service.login({
    email: 'absent@example.invalid',
    password: 'synthetic benchmark password',
    ip: null,
    userAgent: null,
    oldToken: null,
  });
  throw new Error('Unknown user unexpectedly authenticated.');
} catch (failure) {
  if (failure.status !== 401) throw failure;
}
const failedLogin = performance.now() - start;
log(`PBKDF2-SHA256: ${PASSWORD_ITERATIONS} iterations, 20 hashes`);
log(
  `Mean: ${(durations.reduce((a, b) => a + b, 0) / durations.length).toFixed(2)} ms`,
);
log(`Worst: ${Math.max(...durations).toFixed(2)} ms`);
log(`Failed login (unknown email, dummy hash): ${failedLogin.toFixed(2)} ms`);
log(
  'Local Node wall-clock timings; in-memory repository, no database access. These are not production Worker CPU measurements.',
);
